import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function DispatchTracker() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('loe'); // 'loe' | 'invoices'
  const [filterStatus, setFilterStatus] = useState('ALL'); // 'ALL' | 'SENT' | 'NOT_SENT'
  const [loes, setLoes] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dispatchMap, setDispatchMap] = useState(() => {
    try {
      const saved = localStorage.getItem('client_dispatch_records');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    if (!token) {
      setError('Authentication token missing. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const loeUrl = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/loes?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/loes?department_id=${userDeptId}&role=${user.role || 'EMPLOYEE'}`;

      const invUrl = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/invoices?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/invoices?department_id=${userDeptId}&role=${user.role || 'EMPLOYEE'}`;

      const [loeRes, invRes] = await Promise.all([
        fetch(loeUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(invUrl, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const loeData = await loeRes.json();
      const invData = await invRes.json();

      if (loeRes.ok) {
        setLoes(Array.isArray(loeData) ? loeData : loeData.loes || []);
      }
      if (invRes.ok) {
        setInvoices(Array.isArray(invData) ? invData : invData.invoices || []);
      }
    } catch (err) {
      console.error('Error loading dispatch data:', err);
      setError('Failed to load LOEs and Invoices.');
    } finally {
      setLoading(false);
    }
  };

  const isItemSent = (type, item) => {
    const id = type === 'loe' ? item.loe_id : item.invoice_id;
    const key = `${type}_${id}`;
    if (dispatchMap[key] !== undefined) {
      return Boolean(dispatchMap[key]?.sent);
    }
    return Boolean(item.is_sent);
  };

  const getSentTimestamp = (type, item) => {
    const id = type === 'loe' ? item.loe_id : item.invoice_id;
    const key = `${type}_${id}`;
    return dispatchMap[key]?.sent_at || item.sent_at || null;
  };

  const handleToggleSent = async (type, item) => {
    const id = type === 'loe' ? item.loe_id : item.invoice_id;
    const key = `${type}_${id}`;
    const currentlySent = isItemSent(type, item);
    const nextSentState = !currentlySent;
    const timestamp = nextSentState ? new Date().toISOString() : null;

    const updatedMap = {
      ...dispatchMap,
      [key]: { sent: nextSentState, sent_at: timestamp }
    };
    setDispatchMap(updatedMap);
    localStorage.setItem('client_dispatch_records', JSON.stringify(updatedMap));
  };

  const departmentLoes = loes.filter(loe => {
    if (isAdmin) return true;
    return (loe.loe_items || []).some(item => item.service?.department_id === userDeptId);
  });

  const totalLoes = departmentLoes.length;
  const sentLoesCount = departmentLoes.filter(l => isItemSent('loe', l)).length;
  const unsentLoesCount = totalLoes - sentLoesCount;

  const totalInvoices = invoices.length;
  const sentInvoicesCount = invoices.filter(inv => isItemSent('inv', inv)).length;
  const unsentInvoicesCount = totalInvoices - sentInvoicesCount;

  const filteredLoes = departmentLoes.filter(loe => {
    if (filterStatus === 'SENT') return isItemSent('loe', loe);
    if (filterStatus === 'NOT_SENT') return !isItemSent('loe', loe);
    return true;
  });

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'SENT') return isItemSent('inv', inv);
    if (filterStatus === 'NOT_SENT') return !isItemSent('inv', inv);
    return true;
  });

  const getLoeBadge = (status) => {
    if (status === 'Approved') return { background: '#d4edda', color: '#155724' };
    if (status === 'Rejected') return { background: '#f8d7da', color: '#721c24' };
    return { background: '#fff3cd', color: '#856404' };
  };

  const getInvoiceBadge = (status) => {
    if (status === 'Paid') return { background: '#d4edda', color: '#155724' };
    return { background: '#fee2e2', color: '#991b1b' };
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <div style={styles.container}>
        <div style={styles.topHeaderRow}>
          <div>
            <h1 style={styles.pageTitle}>Client Dispatch Tracker</h1>
            <p style={styles.subTitle}>
              Track whether Letters of Engagement and Invoices have been sent to clients
            </p>
          </div>

          <div style={styles.tabGroup}>
            <button
              type="button"
              onClick={() => setActiveTab('loe')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'loe' ? styles.activeTabBtn : {})
              }}
            >
              LOE
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'invoices' ? styles.activeTabBtn : {})
              }}
            >
              Invoices
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        <div style={styles.insightsContainer}>
          <div style={styles.insightsHeader}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
              {activeTab === 'loe' ? '📄 LOE Client Dispatch Status' : '🧾 Invoice Client Dispatch Status'}
            </h2>

            <div style={styles.filterGroup}>
              <button
                type="button"
                onClick={() => setFilterStatus('ALL')}
                style={{
                  ...styles.filterPill,
                  ...(filterStatus === 'ALL' ? styles.activeFilterPill : {})
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('SENT')}
                style={{
                  ...styles.filterPill,
                  ...(filterStatus === 'SENT' ? styles.activeFilterPill : {})
                }}
              >
                Sent to Client
              </button>
              <button
                type="button"
                onClick={() => setFilterStatus('NOT_SENT')}
                style={{
                  ...styles.filterPill,
                  ...(filterStatus === 'NOT_SENT' ? styles.activeFilterPill : {})
                }}
              >
                Not Sent
              </button>
            </div>
          </div>

          {loading ? (
            <div style={styles.loadingState}>Loading records...</div>
          ) : activeTab === 'loe' ? (
            <div>
              <div style={styles.statsGrid}>
                <div style={{ ...styles.statCard, borderTop: '4px solid #6366f1' }}>
                  <span style={styles.statLabel}>Total LOEs</span>
                  <span style={styles.statValue}>{totalLoes}</span>
                  <span style={styles.statSubtext}>All department LOEs</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
                  <span style={styles.statLabel}>Sent to Client</span>
                  <span style={{ ...styles.statValue, color: '#059669' }}>{sentLoesCount}</span>
                  <span style={styles.statSubtext}>Dispatched to client</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #f59e0b' }}>
                  <span style={styles.statLabel}>Not Sent Yet</span>
                  <span style={{ ...styles.statValue, color: '#d97706' }}>{unsentLoesCount}</span>
                  <span style={styles.statSubtext}>Awaiting client dispatch</span>
                </div>
              </div>

              {filteredLoes.length === 0 ? (
                <p style={styles.emptyText}>No matching LOE records found.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>LOE Code</th>
                        <th style={styles.th}>Company &amp; Email</th>
                        <th style={styles.th}>Type / Billing</th>
                        <th style={styles.th}>Currency &amp; Value</th>
                        <th style={styles.th}>Internal Status</th>
                        <th style={styles.th}>Client Dispatch Status</th>
                        <th style={styles.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLoes.map((loe) => {
                        const sent = isItemSent('loe', loe);
                        const sentAt = getSentTimestamp('loe', loe);
                        const currencyCode = loe.currency || 'LKR';
                        const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
                        const totalVal = (loe.loe_items || []).reduce((acc, i) => acc + Number(i.amount || 0), 0);

                        return (
                          <tr key={loe.loe_id} style={styles.tr}>
                            <td
                              onClick={() => navigate(`/loes/${loe.loe_id}`)}
                              style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb', cursor: 'pointer' }}
                            >
                              {loe.loe_code || `LOE #${loe.loe_id}`}
                            </td>
                            <td style={styles.td}>
                              <strong>{loe.company?.name || 'N/A'}</strong>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {loe.company?.email || 'No email on file'}
                              </div>
                            </td>
                            <td style={styles.td}>
                              {loe.type || 'Adhoc'} ({loe.billing_frequency || 'One-Time'})
                            </td>
                            <td style={{ ...styles.td, fontWeight: 'bold' }}>
                              {symbol} {totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({currencyCode})
                            </td>
                            <td style={styles.td}>
                              <span style={{ ...styles.badge, ...getLoeBadge(loe.status) }}>
                                {loe.status}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {sent ? (
                                <div>
                                  <span style={styles.sentBadge}>✅ Sent to Client</span>
                                  {sentAt && (
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                                      {new Date(sentAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={styles.notSentBadge}>⏳ Not Sent</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                onClick={() => handleToggleSent('loe', loe)}
                                style={sent ? styles.markUnsentBtn : styles.markSentBtn}
                              >
                                {sent ? 'Mark Not Sent' : 'Mark as Sent'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={styles.statsGrid}>
                <div style={{ ...styles.statCard, borderTop: '4px solid #3b82f6' }}>
                  <span style={styles.statLabel}>Total Invoices</span>
                  <span style={styles.statValue}>{totalInvoices}</span>
                  <span style={styles.statSubtext}>Generated in system</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
                  <span style={styles.statLabel}>Sent to Client</span>
                  <span style={{ ...styles.statValue, color: '#059669' }}>{sentInvoicesCount}</span>
                  <span style={styles.statSubtext}>Dispatched to client</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #f59e0b' }}>
                  <span style={styles.statLabel}>Not Sent Yet</span>
                  <span style={{ ...styles.statValue, color: '#d97706' }}>{unsentInvoicesCount}</span>
                  <span style={styles.statSubtext}>Awaiting client dispatch</span>
                </div>
              </div>

              {filteredInvoices.length === 0 ? (
                <p style={styles.emptyText}>No matching Invoice records found.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Invoice No.</th>
                        <th style={styles.th}>Company &amp; Email</th>
                        <th style={styles.th}>Amount &amp; Currency</th>
                        <th style={styles.th}>Due Date</th>
                        <th style={styles.th}>Payment Status</th>
                        <th style={styles.th}>Client Dispatch Status</th>
                        <th style={styles.th}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv) => {
                        const sent = isItemSent('inv', inv);
                        const sentAt = getSentTimestamp('inv', inv);
                        const company = inv.job?.loe?.company;
                        const currencyCode = inv.job?.loe?.currency || 'LKR';
                        const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;

                        return (
                          <tr key={inv.invoice_id} style={styles.tr}>
                            <td style={{ ...styles.td, fontWeight: 'bold', color: '#1e293b' }}>
                              INV-{String(inv.invoice_id).padStart(5, '0')}
                            </td>
                            <td style={styles.td}>
                              <strong>{company?.name || 'N/A'}</strong>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>
                                {company?.email || 'No email on file'}
                              </div>
                            </td>
                            <td style={{ ...styles.td, fontWeight: 'bold' }}>
                              {symbol} {Number(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({currencyCode})
                            </td>
                            <td style={styles.td}>
                              {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td style={styles.td}>
                              <span style={{ ...styles.badge, ...getInvoiceBadge(inv.status) }}>
                                {inv.status}
                              </span>
                            </td>
                            <td style={styles.td}>
                              {sent ? (
                                <div>
                                  <span style={styles.sentBadge}>✅ Sent to Client</span>
                                  {sentAt && (
                                    <div style={{ fontSize: '10px', color: '#64748b', marginTop: '3px' }}>
                                      {new Date(sentAt).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={styles.notSentBadge}>⏳ Not Sent</span>
                              )}
                            </td>
                            <td style={styles.td}>
                              <button
                                type="button"
                                onClick={() => handleToggleSent('inv', inv)}
                                style={sent ? styles.markUnsentBtn : styles.markSentBtn}
                              >
                                {sent ? 'Mark Not Sent' : 'Mark as Sent'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { maxWidth: '1240px', margin: '0 auto', padding: '35px 40px' },
  topHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '16px' },
  pageTitle: { margin: 0, fontSize: '26px', color: '#1e293b' },
  subTitle: { margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  tabGroup: { display: 'flex', gap: '12px' },
  tabBtn: { padding: '10px 28px', fontSize: '15px', fontWeight: 'bold', borderRadius: '6px', border: '2px solid #cbd5e1', background: '#ffffff', color: '#334155', cursor: 'pointer', transition: 'all 0.15s ease' },
  activeTabBtn: { background: '#1e293b', color: '#ffffff', borderColor: '#1e293b', boxShadow: '0 4px 10px rgba(30, 41, 59, 0.2)' },
  insightsContainer: { background: '#ffffff', borderRadius: '10px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)', minHeight: '420px' },
  insightsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  filterGroup: { display: 'flex', gap: '8px' },
  filterPill: { padding: '6px 14px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#f8fafc', color: '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' },
  activeFilterPill: { background: '#0284c7', color: '#ffffff', borderColor: '#0284c7' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '18px', marginBottom: '28px' },
  statCard: { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px' },
  statLabel: { fontSize: '13px', fontWeight: 'bold', color: '#64748b' },
  statValue: { fontSize: '30px', fontWeight: '800', color: '#0f172a' },
  statSubtext: { fontSize: '12px', color: '#94a3b8' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { textAlign: 'left', padding: '12px', background: '#f1f5f9', color: '#475569', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1' },
  tr: { borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px', color: '#334155', verticalAlign: 'middle' },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  sentBadge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', display: 'inline-block' },
  notSentBadge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', display: 'inline-block' },
  markSentBtn: { padding: '6px 12px', background: '#0284c7', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' },
  markUnsentBtn: { padding: '6px 12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' },
  loadingState: { padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' },
  emptyText: { color: '#64748b', fontStyle: 'italic', fontSize: '14px' },
  errorBanner: { background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #fca5a5', fontSize: '13px' }
};
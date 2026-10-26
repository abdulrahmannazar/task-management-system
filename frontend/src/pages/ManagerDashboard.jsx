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

const parseScopePoints = (scopeText) => {
  if (!scopeText) return ['Standard Deliverable'];
  const points = String(scopeText)
    .split(/\r?\n|•|●|▪/)
    .map((line) => line.replace(/^[-*•●▪\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1));

  return points.length > 0 ? points : ['Standard Deliverable'];
};

export default function ManagerDashboard() {
  const navigate = useNavigate();

  const [pendingLoes, setPendingLoes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rejectingItemId, setRejectingItemId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Filter States
  const [filterCompany, setFilterCompany] = useState('');
  const [filterBillingType, setFilterBillingType] = useState('ALL');
  const [filterCurrency, setFilterCurrency] = useState('ALL');
  const [filterBillingCycle, setFilterBillingCycle] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchPendingLoes();
    fetchCompanies();
    if (isAdmin) {
      fetchDepartments();
    }
  }, []);

  const fetchPendingLoes = async () => {
    try {
      setLoading(true);
      setError('');
      if (!token) throw new Error('Authentication token missing.');

      const url = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/loes/pending?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/loes/pending?department_id=${userDeptId}&role=${user.role || 'MANAGER'}`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load pending LOEs');

      setPendingLoes(Array.isArray(data) ? data : data.loes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const handleApproveItem = async (e, loeId, itemId) => {
    e.stopPropagation();
    try {
      setError('');
      const response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/items/${itemId}/approve`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to approve item');
      await fetchPendingLoes();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRejectItem = async (e, loeId, itemId) => {
    e.stopPropagation();
    if (!rejectionReason.trim()) {
      setError('Please enter a reason for rejection.');
      return;
    }
    try {
      setError('');
      const response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/items/${itemId}/reject`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to reject item');
      setRejectingItemId(null);
      setRejectionReason('');
      await fetchPendingLoes();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveAll = async (e, loeId) => {
    e.stopPropagation();
    try {
      setError('');
      const response = await fetch(
        `https://task-management-system-6ifq.onrender.com/api/loes/${loeId}/approve-all`,
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
      if (!response.ok) throw new Error(data.error || 'Failed to approve all items');
      await fetchPendingLoes();
    } catch (err) {
      setError(err.message);
    }
  };

  const resetFilters = () => {
    setFilterCompany('');
    setFilterBillingType('ALL');
    setFilterCurrency('ALL');
    setFilterBillingCycle('ALL');
    setFilterDepartment('ALL');
  };

  const filteredLoes = pendingLoes.filter((loe) => {
    const companyName = (loe.company?.name || '').toLowerCase();
    const loeType = loe.type || 'Adhoc';
    const loeCurrency = loe.currency || 'LKR';
    const loeCycle = loe.billing_frequency || 'One-Time';

    if (filterCompany && !companyName.includes(filterCompany.toLowerCase())) {
      return false;
    }
    if (filterBillingType !== 'ALL' && loeType !== filterBillingType) {
      return false;
    }
    if (filterCurrency !== 'ALL' && loeCurrency !== filterCurrency) {
      return false;
    }
    if (filterBillingCycle !== 'ALL' && loeCycle !== filterBillingCycle) {
      return false;
    }
    if (isAdmin && filterDepartment !== 'ALL') {
      const hasDeptItem = (loe.loe_items || []).some(
        (item) => Number(item.service?.department_id) === Number(filterDepartment)
      );
      if (!hasDeptItem) return false;
    }

    return true;
  });

  const hasActiveFilters =
    filterCompany !== '' ||
    filterBillingType !== 'ALL' ||
    filterCurrency !== 'ALL' ||
    filterBillingCycle !== 'ALL' ||
    (isAdmin && filterDepartment !== 'ALL');

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>LOE Approvals Queue</h1>
            <p style={styles.subTitle}>
              Click any LOE card to view its full details and approval workspace.
            </p>
          </div>
          <span style={styles.countBadge}>
            {filteredLoes.length} Pending {filteredLoes.length === 1 ? 'LOE' : 'LOEs'}
          </span>
        </div>

        {/* Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Company Name</label>
            <input
              type="text"
              list="company-options"
              placeholder="Search or select company..."
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              style={styles.filterInput}
            />
            <datalist id="company-options">
              {companies.map((c) => (
                <option key={c.company_id} value={c.name || c.company_name} />
              ))}
            </datalist>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Billing Type</label>
            <select
              value={filterBillingType}
              onChange={(e) => setFilterBillingType(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Types</option>
              <option value="Adhoc">Adhoc</option>
              <option value="Retainer">Retainer</option>
            </select>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Currency Type</label>
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

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Billing Cycle</label>
            <select
              value={filterBillingCycle}
              onChange={(e) => setFilterBillingCycle(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Cycles</option>
              <option value="One-Time">One-Time</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
            </select>
          </div>

          {isAdmin && (
            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Department (Admin)</label>
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                style={styles.filterSelect}
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} style={styles.clearFilterBtn}>
              Reset Filters
            </button>
          )}
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {loading ? (
          <div style={styles.emptyBox}>Loading pending approvals...</div>
        ) : filteredLoes.length === 0 ? (
          <div style={styles.emptyBox}>
            No pending Letters of Engagement match your current filters.
          </div>
        ) : (
          <div style={styles.grid}>
            {filteredLoes.map((loe) => {
              const loeCurrency = loe.currency || 'LKR';
              const loeSymbol = CURRENCY_SYMBOLS[loeCurrency] || loeCurrency;

              const relevantItems = isAdmin
                ? loe.loe_items || []
                : (loe.loe_items || []).filter(
                    (item) =>
                      item.service?.department_id === userDeptId &&
                      (filterDepartment === 'ALL' ||
                        Number(item.service?.department_id) === Number(filterDepartment))
                  );

              const totalValue = (loe.loe_items || []).reduce(
                (acc, curr) => acc + Number(curr.amount || 0),
                0
              );

              return (
                <div
                  key={loe.loe_id}
                  onClick={() => navigate(`/loes/${loe.loe_id}`)}
                  style={styles.card}
                >
                  <div style={styles.cardHeader}>
                    <div>
                      <h3 style={styles.cardTitle}>
                        {loe.loe_code || `LOE #${loe.loe_id}`}
                      </h3>
                      <span style={styles.companySub}>
                        <strong>Company:</strong> {loe.company?.name || 'N/A'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={styles.currencyTag}>{loeCurrency}</span>
                      <span style={styles.statusBadge}>{loe.status}</span>
                    </div>
                  </div>

                  <div style={styles.metaStrip}>
                    <span>
                      <strong>Billing Type:</strong> {loe.type || 'Adhoc'}
                    </span>
                    <span>
                      <strong>Billing Cycle:</strong> {loe.billing_frequency || 'One-Time'}
                    </span>
                    <span>
                      <strong>Start Date:</strong>{' '}
                      {loe.start_date ? new Date(loe.start_date).toLocaleDateString() : 'N/A'}
                    </span>
                    <span style={{ color: '#0369a1', fontWeight: 'bold' }}>
                      Total: {loeSymbol}{' '}
                      {totalValue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </span>
                  </div>

                  <div style={styles.itemsList}>
                    {relevantItems.map((item) => {
                      const scopePoints = parseScopePoints(item.custom_scope);

                      return (
                        <div
                          key={item.loe_item_id}
                          style={styles.itemRow}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ flex: 1, paddingRight: '14px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#1e293b' }}>
                              {item.service?.name}{' '}
                              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal' }}>
                                ({item.service?.department?.name || 'Dept'})
                              </span>
                            </div>

                            <ul style={styles.scopeBulletList}>
                              {scopePoints.map((pt, idx) => (
                                <li key={idx} style={styles.scopeBulletItem}>
                                  {pt}
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '13.5px', color: '#0f172a' }}>
                              {loeSymbol}{' '}
                              {Number(item.amount || 0).toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </div>

                            {item.status === 'Pending' ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  onClick={(e) => handleApproveItem(e, loe.loe_id, item.loe_item_id)}
                                  style={styles.approveBtn}
                                >
                                  ✓ Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRejectingItemId(
                                      rejectingItemId === item.loe_item_id ? null : item.loe_item_id
                                    );
                                    setRejectionReason('');
                                  }}
                                  style={styles.rejectBtn}
                                >
                                  ✕ Reject
                                </button>
                              </div>
                            ) : (
                              <span
                                style={{
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  color: item.status === 'Approved' ? '#15803d' : '#b91c1c'
                                }}
                              >
                                {item.status === 'Approved' ? '✅ Approved' : '❌ Rejected'}
                              </span>
                            )}
                          </div>

                          {rejectingItemId === item.loe_item_id && (
                            <div
                              style={styles.rejectBox}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                placeholder="Enter rejection reason..."
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                style={styles.rejectInput}
                              />
                              <button
                                type="button"
                                onClick={(e) => handleRejectItem(e, loe.loe_id, item.loe_item_id)}
                                style={styles.confirmRejectBtn}
                              >
                                Confirm Reject
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div style={styles.cardFooter}>
                    <span style={styles.viewDetailsLink}>
                      Click to open full LOE details &amp; approval page →
                    </span>

                    <button
                      type="button"
                      onClick={(e) => handleApproveAll(e, loe.loe_id)}
                      style={styles.approveAllBtn}
                    >
                      Approve All Services
                    </button>
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
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' },
  pageTitle: { margin: 0, fontSize: '26px', color: '#1e293b' },
  subTitle: { margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  countBadge: { background: '#1e293b', color: '#fff', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '14px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '18px 20px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
  },
  filterField: { display: 'flex', flexDirection: 'column', gap: '5px', flex: '1', minWidth: '165px' },
  filterLabel: { fontSize: '12px', fontWeight: 'bold', color: '#475569' },
  filterInput: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' },
  filterSelect: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff' },
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
  errorBanner: { background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '6px', marginBottom: '18px', fontSize: '13px' },
  emptyBox: { background: '#fff', padding: '45px', textAlign: 'center', borderRadius: '8px', color: '#64748b', border: '1px solid #e2e8f0' },
  grid: { display: 'flex', flexDirection: 'column', gap: '18px' },
  card: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '20px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
    cursor: 'pointer',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease'
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  cardTitle: { margin: 0, fontSize: '18px', color: '#2563eb' },
  companySub: { fontSize: '14px', color: '#334155', display: 'block', marginTop: '4px' },
  currencyTag: { background: '#e0f2fe', color: '#0369a1', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' },
  statusBadge: { background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' },
  metaStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '20px',
    background: '#f8fafc',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    color: '#475569',
    marginBottom: '14px',
    border: '1px solid #f1f5f9'
  },
  itemsList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' },
  itemRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '12px 14px',
    background: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #e2e8f0',
    cursor: 'default'
  },
  scopeBulletList: {
    margin: '6px 0 0 0',
    paddingLeft: '18px',
    fontSize: '12.5px',
    color: '#334155',
    lineHeight: '1.55'
  },
  scopeBulletItem: {
    marginBottom: '3px'
  },
  approveBtn: { padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  rejectBtn: { padding: '6px 12px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  rejectBox: { width: '100%', display: 'flex', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1' },
  rejectInput: { flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' },
  confirmRejectBtn: { padding: '6px 12px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #e2e8f0' },
  viewDetailsLink: { fontSize: '13px', fontWeight: 'bold', color: '#2563eb' },
  approveAllBtn: { padding: '8px 16px', background: '#0f172a', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }
};
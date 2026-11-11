import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_BASE } from '../utils/api';
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
  if (!scopeText) return ['Standard Professional Services'];
  const points = String(scopeText)
    .split(/\r?\n|•|●|▪/)
    .map((line) => line.replace(/^[-*•●▪\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1));

  return points.length > 0 ? points : ['Standard Professional Services'];
};

export default function ClientLoeApproval() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loe, setLoe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [signatoryName, setSignatoryName] = useState('');
  const [signatoryTitle, setSignatoryTitle] = useState('');
  const [acceptanceDate, setAcceptanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : null;

  useEffect(() => {
    fetchLoe();
  }, [id]);

  const fetchLoe = async () => {
    try {
      setLoading(true);
      setError('');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE}/api/loes/${id}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load Letter of Engagement');

      setLoe(data);
      if (data.client_signatory_name) setSignatoryName(data.client_signatory_name);
      if (data.client_signatory_title) setSignatoryTitle(data.client_signatory_title);
      if (data.client_accepted_at) setAcceptanceDate(new Date(data.client_accepted_at).toISOString().split('T')[0]);
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
      const cacheBuster = `?t=${Date.now()}`;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await fetch(`${API_BASE}/api/loes/${id}/pdf${cacheBuster}`, { headers });
      if (!response.ok) throw new Error('Failed to generate LOE document');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${loe?.loe_code || `LOE-${id}`}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleSubmitAcceptance = async (e) => {
    e.preventDefault();
    if (!signatoryName.trim()) {
      setError('Please enter the full legal name of the authorized signatory.');
      return;
    }
    if (!agreeTerms) {
      setError('Please check the authorization and agreement confirmation checkbox.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      setSuccessMsg('');

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${API_BASE}/api/loes/${id}/client-acceptance`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          signatory_name: signatoryName.trim(),
          signatory_title: signatoryTitle.trim() || 'Authorized Representative',
          acceptance_date: acceptanceDate
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit client acceptance');

      setLoe(data.loe || { ...loe, is_client_accepted: true, client_signatory_name: signatoryName, client_signatory_title: signatoryTitle, client_accepted_at: new Date(acceptanceDate) });
      setSuccessMsg(data.message || 'Client acceptance has been officially confirmed! Engagement tasks can now be allocated.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currencyCode = loe?.currency || 'LKR';
  const currencySymbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
  const totalAmount = (loe?.loe_items || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const isAccepted = Boolean(loe?.is_client_accepted);

  return (
    <div style={styles.pageContainer}>
      {user && <Navbar />}

      <div style={styles.container}>
        {/* Navigation row if logged in */}
        {user && (
          <div style={styles.navRow}>
            <button onClick={() => navigate(`/loes/${id}`)} style={styles.backBtn}>
              ← Back to LOE Details
            </button>
            <button onClick={() => navigate('/dispatch')} style={styles.backBtn}>
              Dispatch Tracker
            </button>
          </div>
        )}

        {/* Header Hero Card */}
        <div style={styles.heroCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
            <div>
              <span style={styles.eyebrow}>Client Acceptance &amp; Engagement Approval Portal</span>
              <h1 style={styles.title}>{loe?.loe_code || `Letter of Engagement #${id}`}</h1>
              <p style={styles.subtitle}>
                Issued for <strong>{loe?.company?.name || 'Client Organization'}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                style={styles.pdfBtn}
              >
                {downloading ? 'Downloading...' : '📄 Download Official PDF'}
              </button>
              {isAccepted ? (
                <span style={styles.acceptedBadge}>✓ Approved by Client</span>
              ) : (
                <span style={styles.pendingBadge}>⏳ Awaiting Client Acceptance</span>
              )}
            </div>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}
        {successMsg && <div style={styles.successBanner}>{successMsg}</div>}

        {loading ? (
          <div style={styles.loadingBox}>Loading Letter of Engagement...</div>
        ) : !loe ? (
          <div style={styles.loadingBox}>Letter of Engagement record not found.</div>
        ) : (
          <div style={styles.contentGrid}>
            {/* Left Column: Scope & Deliverables */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Engagement Overview */}
              <div style={styles.card}>
                <h2 style={styles.cardHeader}>1. Engagement Scope &amp; Deliverables</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                  {(loe.loe_items || []).map((item, idx) => {
                    const points = parseScopePoints(item.custom_scope);
                    return (
                      <div key={item.loe_item_id || idx} style={styles.scopeItemBox}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '15px', color: '#0f172a' }}>
                            {item.service?.name || `Service #${item.service_id}`}
                          </strong>
                          <span style={{ fontWeight: 'bold', color: '#0284c7' }}>
                            {currencySymbol} {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <ul style={styles.bulletList}>
                          {points.map((pt, pIdx) => (
                            <li key={pIdx} style={styles.bulletItem}>
                              {pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Professional Fees Table */}
              <div style={styles.card}>
                <h2 style={styles.cardHeader}>2. Agreed Professional Fees</h2>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Service Scope</th>
                      <th style={styles.th}>Billing Routine</th>
                      <th style={{ ...styles.th, textAlign: 'right' }}>Agreed Fee ({currencyCode})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(loe.loe_items || []).map((item, idx) => (
                      <tr key={idx} style={styles.tr}>
                        <td style={styles.td}>
                          <strong>{item.service?.name || 'Deliverable'}</strong>
                        </td>
                        <td style={styles.td}>{item.service?.billing_type || loe.billing_frequency || 'One-Time'}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold' }}>
                          {currencySymbol} {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ background: '#f8fafc', fontWeight: 'bold' }}>
                      <td colSpan="2" style={{ ...styles.td, color: '#0f172a' }}>
                        Total Agreed Professional Fee
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#0284c7', fontSize: '15px' }}>
                        {currencySymbol} {totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <p style={styles.feeNote}>
                  <strong>Note:</strong> The professional fees listed above exclude travel and other out-of-pocket expenses, which will be billed separately at actual cost upon client authorization.
                </p>
              </div>
            </div>

            {/* Right Column: Formal Client Acceptance Form / Status */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={styles.card}>
                <h2 style={styles.cardHeader}>3. Formal Client Acceptance Form</h2>
                <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px', marginBottom: '16px' }}>
                  Please review the engagement terms above and execute acceptance below to authorize work.
                </p>

                {isAccepted ? (
                  <div style={styles.verifiedBox}>
                    <div style={styles.verifiedIcon}>✓</div>
                    <h3 style={{ margin: '8px 0 4px', fontSize: '17px', color: '#065f46' }}>
                      Engagement Officially Accepted
                    </h3>
                    <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#047857' }}>
                      This Letter of Engagement has been verified and confirmed by the client. Tasks and project onboarding are authorized.
                    </p>

                    <div style={styles.verifiedRow}>
                      <span style={styles.vLabel}>Authorized Signatory:</span>
                      <span style={styles.vVal}>{loe.client_signatory_name}</span>
                    </div>
                    <div style={styles.verifiedRow}>
                      <span style={styles.vLabel}>Designation / Title:</span>
                      <span style={styles.vVal}>{loe.client_signatory_title || 'N/A'}</span>
                    </div>
                    <div style={styles.verifiedRow}>
                      <span style={styles.vLabel}>Acceptance Date:</span>
                      <span style={styles.vVal}>
                        {loe.client_accepted_at ? new Date(loe.client_accepted_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                    <div style={styles.verifiedRow}>
                      <span style={styles.vLabel}>Organization:</span>
                      <span style={styles.vVal}>{loe.company?.name}</span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitAcceptance} style={styles.form}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>
                        Authorized Signatory Full Name <span style={{ color: '#e11d48' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., John Doe"
                        value={signatoryName}
                        onChange={(e) => setSignatoryName(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Designation / Title</label>
                      <input
                        type="text"
                        placeholder="e.g., Managing Director / CFO / Authorized Signatory"
                        value={signatoryTitle}
                        onChange={(e) => setSignatoryTitle(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.formGroup}>
                      <label style={styles.label}>Acceptance Date</label>
                      <input
                        type="date"
                        required
                        value={acceptanceDate}
                        onChange={(e) => setAcceptanceDate(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.agreementBox}>
                      <input
                        type="checkbox"
                        id="agreeTermsCheckbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                      />
                      <label htmlFor="agreeTermsCheckbox" style={styles.checkboxLabel}>
                        I hereby confirm that I am authorized to accept this Letter of Engagement on behalf of <strong>{loe.company?.name || 'Client'}</strong>, and agree to the scope, deliverables, and fees as specified.
                      </label>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting || !agreeTerms || !signatoryName.trim()}
                      style={{
                        ...styles.submitBtn,
                        ...(submitting || !agreeTerms || !signatoryName.trim() ? styles.disabledBtn : {})
                      }}
                    >
                      {submitting ? 'Recording Acceptance...' : 'Authorize & Accept Engagement'}
                    </button>
                  </form>
                )}
              </div>

              {/* Terms & Exclusions Note */}
              <div style={{ ...styles.card, background: '#f8fafc' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>Important Notice</h3>
                <p style={{ margin: '8px 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.5 }}>
                  Under company policy, tasks and operational execution cannot be allocated to staff until this client acceptance step is officially registered. Once accepted, internal project managers are automatically authorized to assign resources.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    paddingBottom: '60px'
  },
  container: {
    maxWidth: '1180px',
    margin: '0 auto',
    padding: '30px 20px'
  },
  navRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px'
  },
  backBtn: {
    padding: '8px 16px',
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    color: '#334155',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  heroCard: {
    background: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    padding: '24px 28px',
    marginBottom: '24px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)'
  },
  eyebrow: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#0284c7',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  title: {
    margin: '4px 0',
    fontSize: '26px',
    color: '#0f172a',
    fontWeight: '800'
  },
  subtitle: {
    margin: 0,
    fontSize: '14.5px',
    color: '#475569'
  },
  pdfBtn: {
    padding: '8px 16px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    color: '#334155',
    cursor: 'pointer'
  },
  acceptedBadge: {
    padding: '8px 16px',
    background: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '13px'
  },
  pendingBadge: {
    padding: '8px 16px',
    background: '#fffbeb',
    color: '#d97706',
    border: '1px solid #fde68a',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '13px'
  },
  errorBanner: {
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    padding: '14px 18px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '13.5px',
    fontWeight: '500'
  },
  successBanner: {
    background: '#ecfdf5',
    color: '#059669',
    border: '1px solid #a7f3d0',
    padding: '14px 18px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '13.5px',
    fontWeight: 'bold'
  },
  loadingBox: {
    textAlign: 'center',
    padding: '60px',
    color: '#64748b',
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: '24px'
  },
  card: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
  },
  cardHeader: {
    margin: 0,
    fontSize: '17px',
    color: '#0f172a',
    fontWeight: '700',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '12px'
  },
  scopeItemBox: {
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '14px 16px'
  },
  bulletList: {
    margin: '8px 0 0',
    paddingLeft: '20px'
  },
  bulletItem: {
    fontSize: '13px',
    color: '#334155',
    marginBottom: '3px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: '14px',
    fontSize: '13px'
  },
  th: {
    background: '#f8fafc',
    color: '#475569',
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '1px solid #e2e8f0',
    fontWeight: 'bold'
  },
  tr: {
    borderBottom: '1px solid #e2e8f0'
  },
  td: {
    padding: '10px 12px',
    color: '#334155'
  },
  feeNote: {
    fontStyle: 'italic',
    fontSize: '12px',
    color: '#64748b',
    marginTop: '12px',
    lineHeight: 1.45
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#334155'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    color: '#0f172a',
    outline: 'none'
  },
  agreementBox: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    background: '#f8fafc',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  checkboxLabel: {
    fontSize: '12.5px',
    color: '#334155',
    lineHeight: 1.45,
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '12px 20px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)',
    marginTop: '6px'
  },
  disabledBtn: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  verifiedBox: {
    background: '#ecfdf5',
    border: '1.5px solid #a7f3d0',
    borderRadius: '8px',
    padding: '20px',
    textAlign: 'center'
  },
  verifiedIcon: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    background: '#059669',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
    fontSize: '22px',
    fontWeight: 'bold'
  },
  verifiedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #d1fae5',
    fontSize: '13px'
  },
  vLabel: {
    color: '#047857',
    fontWeight: '600'
  },
  vVal: {
    color: '#065f46',
    fontWeight: 'bold'
  }
};

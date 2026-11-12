import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiFetch, { API_BASE } from '../utils/api';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';

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

function formatCurrencyBreakdown(map, fallbackZero = 'Rs. 0.00') {
  if (!map || Object.keys(map).length === 0) return fallbackZero;
  return Object.entries(map)
    .map(([curr, amt]) => {
      const sym = CURRENCY_SYMBOLS[curr] || curr;
      return `${sym} ${Number(amt || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    })
    .join(' | ');
}

function validatePhoneInput(rawPhone, fieldLabel = 'Contact number') {
  if (!rawPhone || !String(rawPhone).trim()) return { valid: true };
  const trimmed = String(rawPhone).trim();

  if (!/^\+?[0-9\s\-()]+$/.test(trimmed)) {
    return {
      valid: false,
      error: `${fieldLabel} is invalid: only digits, spaces, hyphens, parentheses, and an optional leading '+' are allowed.`
    };
  }

  const compact = trimmed.replace(/[\s\-()]/g, '');
  const isValid = /^(\+[1-9]\d{9,14}|0\d{9}|[1-9]\d{8,9})$/.test(compact);
  if (!isValid) {
    return {
      valid: false,
      error: `${fieldLabel} is invalid: enter a valid 10-digit local number (e.g. 077 123 4567) or international format with '+' (e.g. +94 77 123 4567).`
    };
  }

  return { valid: true };
}

function validateEmailInput(rawEmail, fieldLabel = 'Email address') {
  if (!rawEmail || !String(rawEmail).trim()) return { valid: true };
  const trimmed = String(rawEmail).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { valid: false, error: `${fieldLabel} format is invalid.` };
  }
  return { valid: true };
}

export default function CompanyManager() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [saving, setSaving] = useState(false);

  // List filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalCompany, setDeleteModalCompany] = useState(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);

  // View Company Details Screen
  const [viewingCompany, setViewingCompany] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const canView = hasPermission(user, 'VIEW_COMPANIES');
  const canEdit = hasPermission(user, 'MANAGE_COMPANIES');

  const initialFormState = {
    name: '',
    client_type: 'Corporate',
    reg_number: '',
    tin_number: '',
    email: '',
    phone_number: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: ''
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchCompanies();
  }, []);

  // Lock background scrolling when modals are open
  useEffect(() => {
    const hasModal = isModalOpen || Boolean(deleteModalCompany);
    document.body.style.overflow = hasModal ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen, deleteModalCompany]);

  // Close open dialogs on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (deleteModalCompany) closeDeleteModal();
        else if (isModalOpen) closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteModalCompany]);

  const showSuccessBanner = (message) => {
    setSuccessMsg(message);
    setTimeout(() => {
      setSuccessMsg((curr) => (curr === message ? '' : curr));
    }, 7000);
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiFetch('/api/companies', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch companies');
      setCompanies(Array.isArray(data) ? data : data.companies || []);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to fetch companies.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewCompany = async (companyId) => {
    try {
      setError('');
      setDetailsLoading(true);

      // Show optimistic shell immediately if available in list
      const cached = companies.find((c) => c.company_id === companyId);
      if (cached) {
        setViewingCompany(cached);
      }

      const response = await apiFetch(`/api/companies/${companyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load company details');
      setViewingCompany(data);
    } catch (err) {
      setError(err.message || 'Failed to load company details');
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setFormData(initialFormState);
    setModalError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
    setModalError('');
  };

  const handleEdit = async (company, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setEditingId(company.company_id);
    setFormData({
      name: company.name || '',
      client_type: company.client_type || 'Corporate',
      reg_number: company.reg_number || '',
      tin_number: company.tin_number || '',
      email: company.email || '',
      phone_number: company.phone_number || '',
      primary_contact_name: company.primary_contact_name || '',
      primary_contact_email: company.primary_contact_email || '',
      primary_contact_phone: company.primary_contact_phone || ''
    });
    setModalError('');
    setIsModalOpen(true);

    // Fetch freshest company record from API so primary/employee contact never misses updates
    try {
      const response = await apiFetch(`/api/companies/${company.company_id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const fresh = await response.json();
        setFormData({
          name: fresh.name || '',
          client_type: fresh.client_type || 'Corporate',
          reg_number: fresh.reg_number || '',
          tin_number: fresh.tin_number || '',
          email: fresh.email || '',
          phone_number: fresh.phone_number || '',
          primary_contact_name: fresh.primary_contact_name || '',
          primary_contact_email: fresh.primary_contact_email || '',
          primary_contact_phone: fresh.primary_contact_phone || ''
        });
      }
    } catch {
      // Fallback already populated from list row
    }
  };

  const validateBeforeSubmit = () => {
    const cleanName = String(formData.name || '').trim();
    const cleanReg = String(formData.reg_number || '').trim();
    const cleanTin = String(formData.tin_number || '').trim();

    if (!cleanName) return 'Company Name is required.';

    const phoneCheck = validatePhoneInput(formData.phone_number, 'Company phone number');
    if (!phoneCheck.valid) return phoneCheck.error;

    const empPhoneCheck = validatePhoneInput(formData.primary_contact_phone, 'Primary / Employee contact phone number');
    if (!empPhoneCheck.valid) return empPhoneCheck.error;

    const emailCheck = validateEmailInput(formData.email, 'Company email');
    if (!emailCheck.valid) return emailCheck.error;

    const empEmailCheck = validateEmailInput(formData.primary_contact_email, 'Primary / Employee contact email');
    if (!empEmailCheck.valid) return empEmailCheck.error;

    // Duplicate protection (Name, Registration Number, TIN Number)
    const duplicate = companies.find((c) => {
      if (editingId && c.company_id === editingId) return false;
      if (c.name && c.name.trim().toLowerCase() === cleanName.toLowerCase()) return true;
      if (cleanReg && c.reg_number && c.reg_number.trim().toLowerCase() === cleanReg.toLowerCase()) return true;
      if (cleanTin && c.tin_number && c.tin_number.trim().toLowerCase() === cleanTin.toLowerCase()) return true;
      return false;
    });

    if (duplicate) {
      if (duplicate.name.trim().toLowerCase() === cleanName.toLowerCase()) {
        return `A company with the name "${duplicate.name.trim()}" already exists.`;
      }
      if (cleanReg && duplicate.reg_number && duplicate.reg_number.trim().toLowerCase() === cleanReg.toLowerCase()) {
        return `Registration Number "${cleanReg}" is already registered to "${duplicate.name}".`;
      }
      if (cleanTin && duplicate.tin_number && duplicate.tin_number.trim().toLowerCase() === cleanTin.toLowerCase()) {
        return `TIN Number "${cleanTin}" is already registered to "${duplicate.name}".`;
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setModalError('');
    setError('');

    const validationErr = validateBeforeSubmit();
    if (validationErr) {
      setModalError(validationErr);
      return;
    }

    const endpoint = editingId
      ? `/api/companies/${editingId}`
      : `/api/companies`;

    const method = editingId ? 'PUT' : 'POST';

    try {
      setSaving(true);
      const response = await apiFetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save company');

      await fetchCompanies();
      if (viewingCompany && viewingCompany.company_id === data.company_id) {
        await handleViewCompany(data.company_id);
      }

      const actionWord = editingId ? 'updated' : 'registered';
      closeModal();
      showSuccessBanner(`Company "${data.name}" has been ${actionWord} successfully.`);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (company, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setDeleteModalCompany(company);
    setDeletePassword('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteModalCompany(null);
    setDeletePassword('');
    setDeleteError('');
  };

  const handleConfirmDelete = async (e) => {
    e.preventDefault();
    if (!deletePassword.trim()) {
      setDeleteError('Please enter your password to confirm deletion.');
      return;
    }

    try {
      setDeleting(true);
      setDeleteError('');
      const response = await apiFetch(`/api/companies/${deleteModalCompany.company_id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-confirm-password': deletePassword
        },
        body: JSON.stringify({
          password: deletePassword,
          emp_id: user.emp_id
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete company');
      }

      const deletedName = deleteModalCompany.name;
      const deletedId = deleteModalCompany.company_id;
      setCompanies((prev) => prev.filter((c) => c.company_id !== deletedId));
      if (viewingCompany && viewingCompany.company_id === deletedId) {
        setViewingCompany(null);
      }

      closeDeleteModal();
      showSuccessBanner(`Company "${deletedName}" has been permanently deleted.`);
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredCompanies = companies.filter((comp) => {
    if (filterType !== 'ALL' && comp.client_type !== filterType) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (comp.name || '').toLowerCase().includes(q) ||
        (comp.reg_number || '').toLowerCase().includes(q) ||
        (comp.tin_number || '').toLowerCase().includes(q) ||
        (comp.email || '').toLowerCase().includes(q) ||
        (comp.phone_number || '').toLowerCase().includes(q) ||
        (comp.primary_contact_name || '').toLowerCase().includes(q) ||
        (comp.primary_contact_email || '').toLowerCase().includes(q) ||
        (comp.primary_contact_phone || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const getLoeStatusBadge = (status) => {
    if (status === 'Approved') return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
    if (status === 'Rejected') return { background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' };
    if (status === 'Discontinued') return { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' };
    return { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' };
  };

  if (!canView) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view the Companies page.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.contentWrapper}>
        {/* Global Feedback Banners */}
        {error && !isModalOpen && !deleteModalCompany && (
          <div style={styles.inlineErrorBox}>{error}</div>
        )}

        {successMsg && (
          <div style={styles.successBanner}>
            <span>✓ {successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              style={styles.dismissSuccessBtn}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* ============================================================
            MODE A: VIEW COMPANY DETAILS & HISTORY SCREEN
           ============================================================ */}
        {viewingCompany ? (
          <div>
            {/* Navigation & Action Bar */}
            <div style={styles.detailsTopBar}>
              <button
                type="button"
                onClick={() => setViewingCompany(null)}
                style={styles.backBtn}
              >
                ← Back to Companies List
              </button>

              {canEdit && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="button"
                    onClick={(e) => handleEdit(viewingCompany, e)}
                    style={styles.editTopBtn}
                  >
                    Edit Company Details
                  </button>
                  <button
                    type="button"
                    onClick={(e) => openDeleteModal(viewingCompany, e)}
                    style={styles.deleteTopBtn}
                  >
                    Delete Company
                  </button>
                </div>
              )}
            </div>

            {/* Company Hero Overview Card */}
            <div style={styles.heroCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h1 style={styles.pageTitle}>{viewingCompany.name}</h1>
                    <span style={styles.badge}>{viewingCompany.client_type || 'Corporate'}</span>
                  </div>
                  <p style={styles.pageSubtitle}>
                    Company ID: #{viewingCompany.company_id}
                    {viewingCompany.reg_number ? ` · Reg No: ${viewingCompany.reg_number}` : ''}
                    {viewingCompany.tin_number ? ` · TIN: ${viewingCompany.tin_number}` : ''}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11.5px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                    Total Outstanding Dues
                  </span>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: '800',
                      color:
                        viewingCompany.summary &&
                        Object.values(viewingCompany.summary.dues_by_currency || {}).some((v) => v > 0)
                          ? '#e11d48'
                          : '#059669'
                    }}
                  >
                    {viewingCompany.summary
                      ? formatCurrencyBreakdown(viewingCompany.summary.dues_by_currency, 'Rs. 0.00 (No Dues)')
                      : 'Loading...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Two-Column Company Info & Primary Employee Contact */}
            <div style={styles.detailsTwoCol}>
              <div style={styles.detailCard}>
                <h3 style={styles.detailCardHeading}>Corporate &amp; Registration Details</h3>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Company Name</span>
                  <span style={styles.detailVal}>{viewingCompany.name}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Client Type</span>
                  <span style={styles.detailVal}>{viewingCompany.client_type || 'Corporate'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Registration Number</span>
                  <span style={styles.detailVal}>{viewingCompany.reg_number || 'Not recorded'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>TIN Number</span>
                  <span style={styles.detailVal}>{viewingCompany.tin_number || 'Not recorded'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Company Email</span>
                  <span style={styles.detailVal}>{viewingCompany.email || 'Not recorded'}</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Company Phone</span>
                  <span style={styles.detailVal}>{viewingCompany.phone_number || 'Not recorded'}</span>
                </div>
              </div>

              <div style={styles.detailCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>
                    Primary Contact Details
                  </h3>
                  <span style={styles.primaryContactBadge}>Employee Contact</span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Contact Full Name</span>
                  <span style={styles.detailVal}>
                    {viewingCompany.primary_contact_name || <em style={{ color: '#94a3b8' }}>Not recorded</em>}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Contact Email</span>
                  <span style={styles.detailVal}>
                    {viewingCompany.primary_contact_email || <em style={{ color: '#94a3b8' }}>Not recorded</em>}
                  </span>
                </div>
                <div style={styles.detailRow}>
                  <span style={styles.detailLabel}>Contact Phone</span>
                  <span style={styles.detailVal}>
                    {viewingCompany.primary_contact_phone || <em style={{ color: '#94a3b8' }}>Not recorded</em>}
                  </span>
                </div>
                {canEdit && !viewingCompany.primary_contact_name && (
                  <button
                    type="button"
                    onClick={(e) => handleEdit(viewingCompany, e)}
                    style={{ marginTop: '14px', ...styles.editButton, width: '100%' }}
                  >
                    + Add Primary Employee Contact
                  </button>
                )}
              </div>
            </div>

            {/* Engagement & Billing Summary Metrics */}
            <div style={styles.metricsGrid}>
              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>LOEs Created</span>
                <div style={styles.metricValue}>{viewingCompany.summary?.total_loes || 0}</div>
                <span style={styles.metricSub}>
                  {viewingCompany.summary?.approved_loes || 0} Approved &middot; {viewingCompany.summary?.pending_loes || 0} Pending
                </span>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Invoices Issued</span>
                <div style={{ ...styles.metricValue, color: '#0284c7' }}>
                  {viewingCompany.summary?.total_invoices || 0}
                </div>
                <span style={styles.metricSub}>
                  Total: {formatCurrencyBreakdown(viewingCompany.summary?.billed_by_currency)}
                </span>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Total Paid</span>
                <div style={{ ...styles.metricValue, color: '#059669', fontSize: '20px' }}>
                  {formatCurrencyBreakdown(viewingCompany.summary?.paid_by_currency)}
                </div>
                <span style={styles.metricSub}>Cleared invoice payments</span>
              </div>

              <div style={styles.metricCard}>
                <span style={styles.metricLabel}>Outstanding Dues</span>
                <div
                  style={{
                    ...styles.metricValue,
                    fontSize: '20px',
                    color: (viewingCompany.summary?.unpaid_invoices_count || 0) > 0 ? '#e11d48' : '#059669'
                  }}
                >
                  {formatCurrencyBreakdown(viewingCompany.summary?.dues_by_currency)}
                </div>
                <span style={styles.metricSub}>
                  {viewingCompany.summary?.unpaid_invoices_count || 0} unpaid invoice(s)
                </span>
              </div>
            </div>

            {detailsLoading && !viewingCompany.loes ? (
              <div style={styles.emptyState}>Loading engagement &amp; billing history...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* History Section 1: LOEs Created */}
                <div style={styles.tableCard}>
                  <div style={styles.tableCardHeader}>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                      Letters of Engagement (LOEs) Created ({(viewingCompany.loes || []).length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('/loes')}
                      style={styles.smallLinkBtn}
                    >
                      Open LOE Manager →
                    </button>
                  </div>

                  {!viewingCompany.loes || viewingCompany.loes.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      No Letters of Engagement have been created for this company yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>LOE Code</th>
                            <th style={styles.th}>Type &amp; Billing</th>
                            <th style={styles.th}>Start Date</th>
                            <th style={styles.th}>Services</th>
                            <th style={styles.th}>Created By</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Total Fee</th>
                            <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingCompany.loes.map((loe) => {
                            const curr = loe.currency || 'LKR';
                            const sym = CURRENCY_SYMBOLS[curr] || curr;
                            const srvNames = [...new Set((loe.loe_items || []).map((i) => i.service?.name).filter(Boolean))];
                            return (
                              <tr
                                key={loe.loe_id}
                                style={styles.clickableTr}
                                onClick={() => navigate(`/loes/${loe.loe_id}`)}
                              >
                                <td style={{ ...styles.td, fontWeight: '700', color: '#0284c7' }}>
                                  {loe.loe_code || `LOE #${loe.loe_id}`}
                                </td>
                                <td style={styles.td}>
                                  {loe.type || 'Adhoc'} ({loe.billing_frequency || 'One-Time'})
                                </td>
                                <td style={styles.td}>
                                  {loe.start_date ? new Date(loe.start_date).toLocaleDateString() : 'N/A'}
                                </td>
                                <td style={styles.td}>
                                  {srvNames.length > 0 ? srvNames.join(', ') : 'Standard Services'}
                                </td>
                                <td style={styles.td}>{loe.creator?.name || 'Staff'}</td>
                                <td style={{ ...styles.td, textAlign: 'right', fontWeight: '700', color: '#0f172a' }}>
                                  {sym}{' '}
                                  {Number(loe.total_value || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                  <span style={{ ...styles.statusPill, ...getLoeStatusBadge(loe.status) }}>
                                    {loe.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* History Section 2: Invoices & Dues */}
                <div style={styles.tableCard}>
                  <div style={styles.tableCardHeader}>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                      Invoices &amp; Dues History ({(viewingCompany.invoices || []).length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => navigate('/invoices')}
                      style={styles.smallLinkBtn}
                    >
                      Open Invoices Page →
                    </button>
                  </div>

                  {!viewingCompany.invoices || viewingCompany.invoices.length === 0 ? (
                    <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13.5px' }}>
                      No invoices recorded for this company yet.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            <th style={styles.th}>Invoice No.</th>
                            <th style={styles.th}>Linked LOE</th>
                            <th style={styles.th}>Issued Date</th>
                            <th style={styles.th}>Due Date</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Invoice Amount</th>
                            <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                            <th style={{ ...styles.th, textAlign: 'right' }}>Balance Due</th>
                          </tr>
                        </thead>
                        <tbody>
                          {viewingCompany.invoices.map((inv) => {
                            const curr = inv.currency || 'LKR';
                            const sym = CURRENCY_SYMBOLS[curr] || curr;
                            return (
                              <tr key={inv.invoice_id} style={styles.tr}>
                                <td style={{ ...styles.td, fontWeight: '700', color: '#0f172a' }}>
                                  {inv.invoice_code}
                                </td>
                                <td
                                  style={{ ...styles.td, color: '#0284c7', fontWeight: '600', cursor: 'pointer' }}
                                  onClick={() => navigate(`/loes/${inv.loe_id}`)}
                                >
                                  {inv.loe_code}
                                </td>
                                <td style={styles.td}>
                                  {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : 'N/A'}
                                </td>
                                <td style={styles.td}>
                                  <span style={{ color: inv.is_overdue ? '#e11d48' : '#334155', fontWeight: inv.is_overdue ? '700' : 'normal' }}>
                                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                                    {inv.is_overdue ? ' (Overdue)' : ''}
                                  </span>
                                </td>
                                <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                                  {sym}{' '}
                                  {Number(inv.total_amount || 0).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </td>
                                <td style={{ ...styles.td, textAlign: 'center' }}>
                                  {inv.is_paid ? (
                                    <span style={{ ...styles.statusPill, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' }}>
                                      Paid
                                    </span>
                                  ) : (
                                    <span style={{ ...styles.statusPill, background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
                                      {inv.is_overdue ? 'Overdue' : inv.status}
                                    </span>
                                  )}
                                </td>
                                <td
                                  style={{
                                    ...styles.td,
                                    textAlign: 'right',
                                    fontWeight: '800',
                                    color: inv.is_paid ? '#059669' : '#e11d48'
                                  }}
                                >
                                  {inv.is_paid
                                    ? `${sym} 0.00`
                                    : `${sym} ${Number(inv.due_amount || 0).toLocaleString('en-US', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2
                                      })}`}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
             MODE B: COMPANIES DIRECTORY LIST VIEW
             ============================================================ */
          <div>
            <div style={styles.headerRow}>
              <div>
                <h1 style={styles.pageTitle}>Companies Directory</h1>
                <p style={styles.pageSubtitle}>
                  Click any company row to view complete corporate details, employee contacts, LOEs created, invoices, and dues.
                </p>
              </div>
              {canEdit && (
                <button onClick={openCreateModal} style={styles.primaryActionBtn}>
                  + Add Company
                </button>
              )}
            </div>

            {/* Search & Filter Bar */}
            <div style={styles.filterBar}>
              <div style={{ flex: 2, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={styles.filterLabel}>Search Companies</label>
                <input
                  type="text"
                  placeholder="Search company name, Reg No., TIN, email, or employee contact..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={styles.filterInput}
                />
              </div>

              <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={styles.filterLabel}>Client Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  style={styles.filterInput}
                >
                  <option value="ALL">All Types</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Individual">Individual</option>
                  <option value="SME">SME</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Non-Profit">Non-Profit</option>
                </select>
              </div>

              {(searchQuery || filterType !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('ALL');
                  }}
                  style={styles.clearFilterBtn}
                >
                  Reset
                </button>
              )}
            </div>

            {/* Full-Width List View Table */}
            <div style={styles.tableCard}>
              <div style={styles.tableCardHeader}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>
                    Registered Companies ({filteredCompanies.length})
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={fetchCompanies}
                  style={styles.refreshBtn}
                >
                  ↻ Refresh
                </button>
              </div>

              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  Loading companies directory...
                </div>
              ) : filteredCompanies.length === 0 ? (
                <div style={{ padding: '45px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
                  {companies.length === 0
                    ? 'No companies registered yet. Click "+ Add Company" above to create one.'
                    : 'No companies match your search or filter criteria.'}
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Company Name &amp; Type</th>
                        <th style={styles.th}>Reg No. &amp; TIN</th>
                        <th style={styles.th}>Company Contact</th>
                        <th style={styles.th}>Emp / Primary Contact</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCompanies.map((comp) => {
                        return (
                          <tr
                            key={comp.company_id}
                            style={styles.clickableTr}
                            onClick={() => handleViewCompany(comp.company_id)}
                            title="Click to view full Company Details & History"
                          >
                            <td style={styles.td}>
                              <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                                {comp.name}
                              </div>
                              <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={styles.badge}>{comp.client_type || 'Corporate'}</span>
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>#{comp.company_id}</span>
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ fontSize: '12.5px', color: '#334155' }}>
                                <strong>Reg:</strong> {comp.reg_number || <span style={{ color: '#94a3b8' }}>N/A</span>}
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#334155', marginTop: '2px' }}>
                                <strong>TIN:</strong> {comp.tin_number || <span style={{ color: '#94a3b8' }}>N/A</span>}
                              </div>
                            </td>

                            <td style={styles.td}>
                              <div style={{ fontSize: '12.5px', color: '#334155' }}>
                                {comp.email || <span style={{ color: '#94a3b8' }}>No email</span>}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                {comp.phone_number || <span style={{ color: '#94a3b8' }}>No phone</span>}
                              </div>
                            </td>

                            <td style={styles.td}>
                              {comp.primary_contact_name || comp.primary_contact_email || comp.primary_contact_phone ? (
                                <div>
                                  <div style={{ fontWeight: '600', color: '#0284c7', fontSize: '12.5px' }}>
                                    {comp.primary_contact_name || 'Primary Contact'}
                                  </div>
                                  {comp.primary_contact_email && (
                                    <div style={{ fontSize: '11.5px', color: '#475569' }}>
                                      {comp.primary_contact_email}
                                    </div>
                                  )}
                                  {comp.primary_contact_phone && (
                                    <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                                      {comp.primary_contact_phone}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  Not recorded
                                </span>
                              )}
                            </td>

                            <td style={{ ...styles.td, textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleViewCompany(comp.company_id)}
                                  style={styles.viewButton}
                                >
                                  View
                                </button>
                                {canEdit && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={(e) => handleEdit(comp, e)}
                                      style={styles.editButton}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => openDeleteModal(comp, e)}
                                      style={styles.deleteButton}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Creation & Editing Modal Dialog */}
      {isModalOpen && canEdit && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? 'Edit Company Details' : 'Register New Company'}
                </h2>
                <p style={styles.modalSubtitle}>
                  {editingId
                    ? 'Update company registration and primary employee contact details.'
                    : 'Add a new client company entity and primary contact details.'}
                </p>
              </div>
              <button onClick={closeModal} style={styles.closeBtn} title="Close dialog">
                ✕
              </button>
            </div>

            {modalError && <div style={styles.errorBox}>{modalError}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Company Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Nexus Corp Ltd"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Client Type *</label>
                <select
                  name="client_type"
                  value={formData.client_type}
                  onChange={handleChange}
                  required
                  style={styles.input}
                >
                  <option value="Corporate">Corporate</option>
                  <option value="Individual">Individual</option>
                  <option value="SME">SME</option>
                  <option value="Partnership">Partnership</option>
                  <option value="Non-Profit">Non-Profit</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Registration Number</label>
                  <input
                    type="text"
                    name="reg_number"
                    value={formData.reg_number}
                    onChange={handleChange}
                    placeholder="e.g. PV-123456"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>TIN Number</label>
                  <input
                    type="text"
                    name="tin_number"
                    value={formData.tin_number}
                    onChange={handleChange}
                    placeholder="e.g. TIN-987654321"
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Company Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="e.g. contact@nexuscorp.com"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Company Phone Number</label>
                  <input
                    type="text"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    placeholder="e.g. 011 234 5678 / +94 11..."
                    style={styles.input}
                  />
                  <span style={styles.inputHint}>10 digits local or +country code</span>
                </div>
              </div>

              {/* Dedicated Section: Company Employee Primary Contact Details */}
              <div style={styles.primaryContactSectionCard}>
                <div style={styles.primaryContactHeaderRow}>
                  <div>
                    <h3 style={styles.primaryContactTitle}>Primary Contact Details</h3>
                    <p style={styles.primaryContactDesc}>
                      Record the primary company employee / liaison for engagement coordination
                    </p>
                  </div>
                  <span style={styles.primaryContactBadge}>Employee Contact</span>
                </div>

                <div style={styles.fieldGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    name="primary_contact_name"
                    value={formData.primary_contact_name}
                    onChange={handleChange}
                    placeholder="e.g. Sarah Jenkins (Finance Director)"
                    style={styles.input}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Email Address</label>
                    <input
                      type="email"
                      name="primary_contact_email"
                      value={formData.primary_contact_email}
                      onChange={handleChange}
                      placeholder="e.g. sarah@company.com"
                      style={styles.input}
                    />
                  </div>

                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Phone Number</label>
                    <input
                      type="text"
                      name="primary_contact_phone"
                      value={formData.primary_contact_phone}
                      onChange={handleChange}
                      placeholder="e.g. 077 123 4567"
                      style={styles.input}
                    />
                  </div>
                </div>
              </div>

              <div style={styles.buttonGroup}>
                <button type="submit" disabled={saving} style={styles.button}>
                  {saving ? 'Saving...' : editingId ? 'Update Company' : 'Create Company'}
                </button>
                <button
                  type="button"
                  onClick={closeModal}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password-Protected Delete Confirmation Modal */}
      {deleteModalCompany && (
        <div style={styles.modalOverlay} onClick={closeDeleteModal}>
          <div style={{ ...styles.modalContent, maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={{ ...styles.modalTitle, color: '#e11d48' }}>Delete Company Confirmation</h2>
                <p style={styles.modalSubtitle}>
                  Password verification is required before permanently deleting a company.
                </p>
              </div>
              <button onClick={closeDeleteModal} style={styles.closeBtn} title="Close">
                ✕
              </button>
            </div>

            <div style={styles.deleteWarningBox}>
              You are about to permanently remove <strong>{deleteModalCompany.name}</strong> (#{deleteModalCompany.company_id}). This action cannot be undone.
              {(deleteModalCompany.summary?.total_loes || 0) > 0 && (
                <div style={{ marginTop: '8px', fontWeight: '700', color: '#9f1239' }}>
                  Note: This company has {deleteModalCompany.summary.total_loes} linked LOE(s) and cannot be deleted while active history exists.
                </div>
              )}
            </div>

            {deleteError && <div style={styles.errorBox}>{deleteError}</div>}

            <form onSubmit={handleConfirmDelete} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Enter Your Account Password *</label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password to confirm deletion"
                  autoFocus
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.buttonGroup}>
                <button
                  type="submit"
                  disabled={deleting}
                  style={{ ...styles.confirmDeleteBtn, opacity: deleting ? 0.6 : 1 }}
                >
                  {deleting ? 'Verifying & Deleting...' : 'Confirm & Delete Company'}
                </button>
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  contentWrapper: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '35px 40px'
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '22px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '25px',
    fontWeight: '700',
    color: '#0f172a'
  },
  pageSubtitle: {
    margin: '4px 0 0 0',
    color: '#64748b',
    fontSize: '13.5px'
  },
  primaryActionBtn: {
    padding: '10px 20px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)'
  },
  inlineErrorBox: {
    padding: '12px 16px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    fontSize: '13.5px',
    border: '1px solid #fecdd3',
    marginBottom: '18px'
  },
  successBanner: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#ecfdf5',
    color: '#059669',
    borderRadius: '6px',
    fontSize: '13.5px',
    fontWeight: '600',
    border: '1px solid #a7f3d0',
    marginBottom: '18px'
  },
  dismissSuccessBtn: {
    background: 'none',
    border: 'none',
    color: '#059669',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px'
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '16px 18px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  filterLabel: {
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#475569'
  },
  filterInput: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    background: '#ffffff',
    color: '#0f172a',
    outline: 'none'
  },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#f8fafc',
    color: '#e11d48',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '12px',
    cursor: 'pointer',
    height: '36px'
  },
  tableCard: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    overflow: 'hidden'
  },
  tableCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    background: '#ffffff'
  },
  refreshBtn: {
    padding: '6px 12px',
    background: '#f8fafc',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: '700',
    borderBottom: '1px solid #e2e8f0',
    fontSize: '12px'
  },
  tr: {
    borderBottom: '1px solid #e2e8f0'
  },
  clickableTr: {
    borderBottom: '1px solid #e2e8f0',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },
  td: {
    padding: '14px 16px',
    color: '#334155',
    verticalAlign: 'middle'
  },
  badge: {
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '600'
  },
  statusPill: {
    padding: '3px 10px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: '700',
    display: 'inline-block',
    whiteSpace: 'nowrap'
  },
  viewButton: {
    padding: '6px 10px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '12px'
  },
  editButton: {
    padding: '6px 10px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '12px'
  },
  deleteButton: {
    padding: '6px 10px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '12px'
  },

  // Details Screen Styles
  detailsTopBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  backBtn: {
    padding: '8px 16px',
    background: '#ffffff',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  editTopBtn: {
    padding: '8px 16px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer'
  },
  deleteTopBtn: {
    padding: '8px 16px',
    background: '#e11d48',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '13px',
    cursor: 'pointer'
  },
  heroCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '24px 28px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
  },
  detailsTwoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: '20px',
    marginBottom: '20px'
  },
  detailCard: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  detailCardHeading: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    color: '#0f172a',
    fontWeight: '700',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '10px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid #f1f5f9',
    fontSize: '13px',
    gap: '12px'
  },
  detailLabel: {
    color: '#64748b',
    fontWeight: '500'
  },
  detailVal: {
    color: '#0f172a',
    fontWeight: '600',
    textAlign: 'right'
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
    gap: '16px',
    marginBottom: '24px'
  },
  metricCard: {
    background: '#ffffff',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '16px 20px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  metricLabel: {
    fontSize: '11.5px',
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.4px'
  },
  metricValue: {
    fontSize: '24px',
    fontWeight: '800',
    color: '#0f172a',
    marginTop: '6px'
  },
  metricSub: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '4px',
    display: 'block'
  },
  smallLinkBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontWeight: '700',
    fontSize: '12.5px',
    cursor: 'pointer'
  },
  emptyState: {
    background: '#ffffff',
    padding: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    fontSize: '14px'
  },

  // Modal Dialog Styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    backdropFilter: 'blur(2px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
    padding: '20px'
  },
  modalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '580px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '28px',
    boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
    border: '1px solid #e2e8f0'
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
    marginBottom: '18px'
  },
  modalTitle: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '700',
    color: '#0f172a'
  },
  modalSubtitle: {
    margin: '4px 0 0',
    fontSize: '13px',
    color: '#64748b'
  },
  closeBtn: {
    background: '#f1f5f9',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    fontSize: '15px',
    cursor: 'pointer',
    color: '#475569',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
  },
  deleteWarningBox: {
    background: '#fff1f2',
    color: '#9f1239',
    border: '1px solid #fecdd3',
    padding: '12px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    lineHeight: 1.45,
    marginBottom: '16px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  label: {
    fontSize: '12.5px',
    fontWeight: 'bold',
    color: '#334155'
  },
  input: {
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    color: '#0f172a',
    outline: 'none',
    background: '#ffffff',
    boxSizing: 'border-box',
    width: '100%'
  },
  inputHint: {
    fontSize: '11px',
    color: '#64748b'
  },
  primaryContactSectionCard: {
    marginTop: '6px',
    padding: '16px',
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  primaryContactHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '10px',
    marginBottom: '2px'
  },
  primaryContactTitle: {
    margin: 0,
    fontSize: '14px',
    color: '#0f172a',
    fontWeight: '700'
  },
  primaryContactDesc: {
    margin: '2px 0 0',
    fontSize: '12px',
    color: '#64748b'
  },
  primaryContactBadge: {
    fontSize: '11px',
    fontWeight: 'bold',
    background: '#e0f2fe',
    color: '#0284c7',
    padding: '3px 8px',
    borderRadius: '12px',
    whiteSpace: 'nowrap'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  button: {
    flex: '1',
    padding: '10px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  confirmDeleteBtn: {
    flex: '1',
    padding: '10px',
    background: '#e11d48',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  cancelButton: {
    flex: '1',
    padding: '10px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  }
};

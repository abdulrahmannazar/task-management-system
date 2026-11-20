import React, { useState, useEffect } from 'react';
import { API_BASE, fetchCachedJson, fetchPdfBlob, prewarmPdfBlob } from '../utils/api';
import BlobLoader from '../components/BlobLoader';
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

export default function InvoiceManager() {
  const { hasPermission } = usePermissions();

  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [remindingId, setRemindingId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  // View Controls
  const [activeMainTab, setActiveMainTab] = useState('invoices'); // 'invoices' | 'reports'
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [viewingInvoice, setViewingInvoice] = useState(null); // In-detail view screen
  const [detailSubTab, setDetailSubTab] = useState('breakdown'); // 'breakdown' | 'template'

  // Filter States
  const [filterInvoiceNo, setFilterInvoiceNo] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterCurrency, setFilterCurrency] = useState('ALL');

  // Payment Modal
  const [paymentModalInvoice, setPaymentModalInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentTypeOption, setPaymentTypeOption] = useState('full'); // 'full' | 'partial'
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

  // Proforma Creation Modal
  const [isProformaModalOpen, setIsProformaModalOpen] = useState(false);
  const [selectedSourceInvoiceId, setSelectedSourceInvoiceId] = useState('');
  const [proformaAdvancePct, setProformaAdvancePct] = useState('30'); // '20', '30', '50', '100', 'custom'
  const [proformaCustomAmount, setProformaCustomAmount] = useState('');
  const [proformaDueDate, setProformaDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().split('T')[0];
  });
  const [proformaNotes, setProformaNotes] = useState('');
  const [creatingProforma, setCreatingProforma] = useState(false);

  // Reports State
  const [reportSubTab, setReportSubTab] = useState('clients'); // 'clients' | 'departments' | 'aging'
  const [agingBucketFilter, setAgingBucketFilter] = useState('ALL');
  const [clientReportSearch, setClientReportSearch] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const canViewPage = hasPermission(user, 'VIEW_INVOICES');
  const canManage = hasPermission(user, 'MANAGE_INVOICES');
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        fetchInvoices(),
        fetchCompanies(),
        fetchDepartments()
      ]);
    };
    init();
  }, []);

  // Sync viewing invoice when invoices list updates
  useEffect(() => {
    if (viewingInvoice) {
      const refreshed = invoices.find((inv) => inv.invoice_id === viewingInvoice.invoice_id);
      if (refreshed) setViewingInvoice(refreshed);
    }
  }, [invoices]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError('');

      const url = isAdmin
        ? `${API_BASE}/api/invoices?role=ADMIN`
        : `${API_BASE}/api/invoices?department_id=${userDeptId}&role=${user.role || 'EMPLOYEE'}`;

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
      const response = await fetch(`${API_BASE}/api/companies`, {
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
      const response = await fetch(`${API_BASE}/api/auth/departments`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) {
        setDepartments(data);
      }
    } catch (err) {
      console.error('Failed to load departments:', err);
    }
  };

  const showSuccessBanner = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 6000);
  };

  const handleSendReminder = async (invoiceId) => {
    try {
      setRemindingId(invoiceId);
      setError('');

      const response = await fetch(`${API_BASE}/api/invoices/${invoiceId}/remind`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send reminder email');

      showSuccessBanner(`Payment reminder email dispatched for INV-${String(invoiceId).padStart(5, '0')}`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setRemindingId(null);
    }
  };

  const getInvoicePdfVersion = (invObj) => {
    if (!invObj) return '';
    return `${invObj.invoice_id}_${invObj.status}_${invObj.total_amount}_${invObj.paid_amount}_${invObj.invoice_type}_${invObj.due_date || ''}_${invObj.notes || ''}_${invObj.job?.loe?.company?.name || ''}_${invObj.job?.loe?.company?.reg_number || ''}_${invObj.job?.loe?.company?.client_type || ''}`;
  };

  const prewarmInvoicePdf = (invoiceId) => {
    const invObj =
      viewingInvoice && viewingInvoice.invoice_id === invoiceId
        ? viewingInvoice
        : invoices.find((i) => i.invoice_id === invoiceId);
    prewarmPdfBlob(`/api/invoices/${invoiceId}/pdf`, {
      token,
      versionKey: getInvoicePdfVersion(invObj)
    });
  };

  useEffect(() => {
    if (viewingInvoice?.invoice_id) {
      prewarmInvoicePdf(viewingInvoice.invoice_id);
    }
  }, [viewingInvoice]);

  const handleDownloadPdf = async (invoiceId) => {
    try {
      setDownloadingId(invoiceId);
      setError('');

      const invObj =
        viewingInvoice && viewingInvoice.invoice_id === invoiceId
          ? viewingInvoice
          : invoices.find((i) => i.invoice_id === invoiceId);

      const blob = await fetchPdfBlob(`/api/invoices/${invoiceId}/pdf`, {
        token,
        versionKey: getInvoicePdfVersion(invObj)
      });

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

  // Payment Recording
  const openPaymentModal = (invoice, e) => {
    if (e) e.stopPropagation();
    const total = Number(invoice.total_amount || 0);
    const paid = Number(invoice.paid_amount || 0);
    const balance = Math.max(0, total - paid);

    setPaymentModalInvoice(invoice);
    setPaymentTypeOption('full');
    setPaymentAmount(balance.toFixed(2));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMethod('Bank Transfer');
    setPaymentReference('');
    setPaymentNotes('');
  };

  const closePaymentModal = () => {
    setPaymentModalInvoice(null);
    setPaymentAmount('');
  };

  const handlePaymentTypeChange = (type) => {
    setPaymentTypeOption(type);
    if (!paymentModalInvoice) return;
    const total = Number(paymentModalInvoice.total_amount || 0);
    const paid = Number(paymentModalInvoice.paid_amount || 0);
    const balance = Math.max(0, total - paid);

    if (type === 'full') {
      setPaymentAmount(balance.toFixed(2));
    } else {
      setPaymentAmount((balance / 2).toFixed(2));
    }
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;

    const amt = parseFloat(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }

    const total = Number(paymentModalInvoice.total_amount || 0);
    const alreadyPaid = Number(paymentModalInvoice.paid_amount || 0);
    const balance = Math.max(0, total - alreadyPaid);

    if (amt > balance + 0.01) {
      setError(`Payment amount cannot exceed current balance due (${paymentModalInvoice.job?.loe?.currency || 'LKR'} ${balance.toFixed(2)}).`);
      return;
    }

    try {
      setSavingPayment(true);
      setError('');

      const response = await fetch(`${API_BASE}/api/invoices/${paymentModalInvoice.invoice_id}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amt,
          payment_date: paymentDate,
          payment_method: paymentMethod,
          reference_no: paymentReference,
          notes: paymentNotes
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record payment');

      closePaymentModal();
      showSuccessBanner(`Payment of ${paymentModalInvoice.job?.loe?.currency || 'Rs.'} ${amt.toLocaleString(undefined, { minimumFractionDigits: 2 })} recorded successfully!`);
      await fetchInvoices();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPayment(false);
    }
  };

  // Proforma Invoice Creation
  const openProformaModal = (sourceInvoice = null) => {
    if (sourceInvoice) {
      setSelectedSourceInvoiceId(String(sourceInvoice.invoice_id));
      const total = Number(sourceInvoice.total_amount || 0);
      setProformaAdvancePct('30');
      setProformaCustomAmount((total * 0.3).toFixed(2));
      setProformaNotes(`30% Advance Payment Request for ${sourceInvoice.job?.loe?.company?.name || 'Client'} (Contract: INV-${String(sourceInvoice.invoice_id).padStart(5, '0')})`);
    } else {
      setSelectedSourceInvoiceId(invoices.length > 0 ? String(invoices[0].invoice_id) : '');
      const firstInv = invoices[0];
      const total = firstInv ? Number(firstInv.total_amount || 0) : 0;
      setProformaAdvancePct('30');
      setProformaCustomAmount((total * 0.3).toFixed(2));
      setProformaNotes(firstInv ? `30% Advance Payment Request for ${firstInv.job?.loe?.company?.name || 'Client'}` : 'Advance Payment Request');
    }
    setIsProformaModalOpen(true);
  };

  const handleSourceInvoiceChange = (invId) => {
    setSelectedSourceInvoiceId(invId);
    const sourceInv = invoices.find((i) => String(i.invoice_id) === String(invId));
    if (sourceInv) {
      const total = Number(sourceInv.total_amount || 0);
      const pct = proformaAdvancePct === 'custom' ? 0.3 : Number(proformaAdvancePct) / 100;
      setProformaCustomAmount((total * pct).toFixed(2));
      setProformaNotes(`${proformaAdvancePct === 'custom' ? 'Custom' : proformaAdvancePct + '%'} Advance Payment Request for ${sourceInv.job?.loe?.company?.name || 'Client'}`);
    }
  };

  const handleAdvancePctChange = (pct) => {
    setProformaAdvancePct(pct);
    const sourceInv = invoices.find((i) => String(i.invoice_id) === String(selectedSourceInvoiceId));
    if (sourceInv && pct !== 'custom') {
      const total = Number(sourceInv.total_amount || 0);
      const calculated = total * (Number(pct) / 100);
      setProformaCustomAmount(calculated.toFixed(2));
      setProformaNotes(`${pct}% Advance Payment Request for ${sourceInv.job?.loe?.company?.name || 'Client'}`);
    }
  };

  const handleCreateProformaInvoice = async (e) => {
    e.preventDefault();
    const sourceInv = invoices.find((i) => String(i.invoice_id) === String(selectedSourceInvoiceId));
    if (!sourceInv) {
      setError('Please select a valid source invoice/engagement to derive the Proforma invoice from.');
      return;
    }

    const amt = parseFloat(proformaCustomAmount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid advance payment amount.');
      return;
    }

    try {
      setCreatingProforma(true);
      setError('');

      const response = await fetch(`${API_BASE}/api/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          job_id: sourceInv.job_id,
          total_amount: amt,
          due_date: proformaDueDate,
          invoice_type: 'Proforma',
          notes: proformaNotes || `Advance Payment Request (${sourceInv.job?.loe?.company?.name || 'Client'})`
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create Proforma invoice');

      setIsProformaModalOpen(false);
      showSuccessBanner(`Proforma Invoice INV-${String(data.invoice_id).padStart(5, '0')} created successfully!`);
      await fetchInvoices();
      setViewingInvoice(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingProforma(false);
    }
  };

  const resetFilters = () => {
    setFilterInvoiceNo('');
    setFilterCompany('');
    setFilterDepartment('ALL');
    setFilterStatus('ALL');
    setFilterType('ALL');
    setFilterCurrency('ALL');
  };

  // Filter Logic
  const filteredInvoices = invoices.filter((inv) => {
    const invCode = `INV-${String(inv.invoice_id).padStart(5, '0')}`.toLowerCase();
    const rawId = String(inv.invoice_id);
    const company = inv.job?.loe?.company;
    const compName = (company?.name || company?.company_name || '').toLowerCase();
    const invStatus = inv.status || 'Not Paid';
    const invType = inv.invoice_type || 'Standard';
    const invCurrency = inv.job?.loe?.currency || 'LKR';

    if (filterInvoiceNo.trim()) {
      const q = filterInvoiceNo.trim().toLowerCase();
      const strippedQ = q.replace(/^inv-?/i, '').replace(/^0+/, '');
      const matchesFullCode = invCode.includes(q);
      const matchesRawId = rawId.includes(q) || (strippedQ !== '' && rawId === strippedQ);
      if (!matchesFullCode && !matchesRawId) return false;
    }

    if (filterCompany.trim() && !compName.includes(filterCompany.trim().toLowerCase())) {
      return false;
    }

    if (filterDepartment !== 'ALL') {
      const loeItems = inv.job?.loe?.loe_items || [];
      const matchesDept = loeItems.some(
        (item) => Number(item.service?.department_id) === Number(filterDepartment)
      );
      if (!matchesDept) return false;
    }

    if (filterStatus !== 'ALL') {
      if (filterStatus === 'Paid' && invStatus !== 'Paid') return false;
      if (filterStatus === 'Partially Paid' && invStatus !== 'Partially Paid') return false;
      if (filterStatus === 'Not Paid' && invStatus !== 'Not Paid') return false;
    }

    if (filterType !== 'ALL' && invType !== filterType) {
      return false;
    }

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
    filterType !== 'ALL' ||
    filterCurrency !== 'ALL';

  // Compute Reports Data
  const computeReports = () => {
    const now = new Date();
    let totalInvoicedSum = 0;
    let totalPaidSum = 0;
    let overdueCountSum = 0;

    const clientsMap = new Map();
    const deptMap = new Map();
    const aging = {
      current: { label: 'Current (0-30 Days)', count: 0, total_amount: 0, balance_due: 0, invoices: [] },
      days_31_60: { label: '31-60 Days Overdue', count: 0, total_amount: 0, balance_due: 0, invoices: [] },
      days_61_90: { label: '61-90 Days Overdue', count: 0, total_amount: 0, balance_due: 0, invoices: [] },
      days_90_plus: { label: '90+ Days Overdue (Critical)', count: 0, total_amount: 0, balance_due: 0, invoices: [] }
    };

    invoices.forEach((inv) => {
      const company = inv.job?.loe?.company;
      const compId = company?.company_id || 0;
      const compName = company?.name || 'Unknown Client';
      const totalAmt = Number(inv.total_amount || 0);
      const paidAmt = Number(inv.paid_amount || 0);
      const balance = Math.max(0, totalAmt - paidAmt);
      const isOverdue = inv.status !== 'Paid' && inv.due_date && new Date(inv.due_date) < now;

      totalInvoicedSum += totalAmt;
      totalPaidSum += paidAmt;
      if (isOverdue) overdueCountSum += 1;

      // Client Aggregation
      if (!clientsMap.has(compId)) {
        clientsMap.set(compId, {
          company_id: compId,
          company_name: compName,
          total_invoiced: 0,
          total_paid: 0,
          balance_due: 0,
          invoice_count: 0,
          overdue_count: 0
        });
      }
      const c = clientsMap.get(compId);
      c.total_invoiced += totalAmt;
      c.total_paid += paidAmt;
      c.balance_due += balance;
      c.invoice_count += 1;
      if (isOverdue) c.overdue_count += 1;

      // Department Aggregation
      const loeItems = inv.job?.loe?.loe_items || [];
      const deptsSeen = new Set();
      loeItems.forEach((item) => {
        const d = item.service?.department;
        if (d && !deptsSeen.has(d.department_id)) {
          deptsSeen.add(d.department_id);
          if (!deptMap.has(d.department_id)) {
            deptMap.set(d.department_id, {
              department_id: d.department_id,
              department_name: d.name,
              total_invoiced: 0,
              total_paid: 0,
              balance_due: 0,
              invoice_count: 0
            });
          }
          const dStat = deptMap.get(d.department_id);
          dStat.total_invoiced += totalAmt;
          dStat.total_paid += paidAmt;
          dStat.balance_due += balance;
          dStat.invoice_count += 1;
        }
      });

      // Aging Breakdown (Unpaid / Partially Paid)
      if (inv.status !== 'Paid' && balance > 0) {
        const dueDate = new Date(inv.due_date || inv.issued_date);
        const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

        let bucketKey = 'current';
        if (diffDays > 90) bucketKey = 'days_90_plus';
        else if (diffDays > 60) bucketKey = 'days_61_90';
        else if (diffDays > 30) bucketKey = 'days_31_60';

        aging[bucketKey].count += 1;
        aging[bucketKey].total_amount += totalAmt;
        aging[bucketKey].balance_due += balance;
        aging[bucketKey].invoices.push({
          ...inv,
          diffDays,
          balance
        });
      }
    });

    return {
      totalInvoicedSum,
      totalPaidSum,
      totalBalanceSum: Math.max(0, totalInvoicedSum - totalPaidSum),
      overdueCountSum,
      clientsList: Array.from(clientsMap.values()).sort((a, b) => b.balance_due - a.balance_due),
      departmentList: Array.from(deptMap.values()).sort((a, b) => b.total_invoiced - a.total_invoiced),
      aging
    };
  };

  const reportsData = computeReports();

  const getStatusBadgeStyle = (status) => {
    if (status === 'Paid') {
      return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
    }
    if (status === 'Partially Paid') {
      return { background: '#e0f2fe', color: '#0284c7', border: '1px solid #bae6fd' };
    }
    return { background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' };
  };

  if (!canViewPage) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view the Invoices page.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>

        {/* Global Feedback Banners */}
        {error && (
          <div style={styles.errorBanner}>
            <span>{error}</span>
            <button type="button" onClick={() => setError('')} style={styles.dismissBtn}>✕</button>
          </div>
        )}
        {successMsg && (
          <div style={styles.successBanner}>
            <span>{successMsg}</span>
            <button type="button" onClick={() => setSuccessMsg('')} style={styles.dismissBtn}>✕</button>
          </div>
        )}

        {/* ============================================================
            MODE A: IN-DETAIL INVOICE VIEW SCREEN
           ============================================================ */}
        {viewingInvoice ? (
          <div>
            {/* Top Navigation & Actions Bar */}
            <div style={styles.detailsTopBar}>
              <button
                type="button"
                onClick={() => setViewingInvoice(null)}
                style={styles.backBtn}
              >
                ← Back to Invoices List
              </button>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
                {/* Switch between Breakdown and Printable Template Preview */}
                <div style={styles.segmentedToggle}>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('breakdown')}
                    style={{
                      ...styles.segmentBtn,
                      background: detailSubTab === 'breakdown' ? '#0284c7' : 'transparent',
                      color: detailSubTab === 'breakdown' ? '#ffffff' : '#475569',
                      fontWeight: detailSubTab === 'breakdown' ? 'bold' : 'normal'
                    }}
                  >
                    Financial Breakdown
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailSubTab('template')}
                    style={{
                      ...styles.segmentBtn,
                      background: detailSubTab === 'template' ? '#0284c7' : 'transparent',
                      color: detailSubTab === 'template' ? '#ffffff' : '#475569',
                      fontWeight: detailSubTab === 'template' ? 'bold' : 'normal'
                    }}
                  >
                    Official Document Preview
                  </button>
                </div>

                {canManage && viewingInvoice.status !== 'Paid' && (
                  <button
                    type="button"
                    onClick={(e) => openPaymentModal(viewingInvoice, e)}
                    style={styles.primaryActionBtn}
                  >
                    + Receive Payment
                  </button>
                )}

                <button
                  type="button"
                  onMouseEnter={() => prewarmInvoicePdf(viewingInvoice.invoice_id)}
                  onClick={() => handleDownloadPdf(viewingInvoice.invoice_id)}
                  disabled={downloadingId === viewingInvoice.invoice_id}
                  style={styles.secondaryActionBtn}
                >
                  {downloadingId === viewingInvoice.invoice_id ? 'Generating PDF...' : 'Download PDF'}
                </button>

                {canManage && viewingInvoice.status !== 'Paid' && (
                  <button
                    type="button"
                    onClick={() => handleSendReminder(viewingInvoice.invoice_id)}
                    disabled={remindingId === viewingInvoice.invoice_id}
                    style={styles.remindTopBtn}
                  >
                    {remindingId === viewingInvoice.invoice_id ? 'Sending...' : 'Send Reminder Email'}
                  </button>
                )}
              </div>
            </div>

            {/* Invoice Hero Overview Card */}
            <div style={styles.heroCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
                    <h1 style={{ margin: 0, fontSize: '26px', color: '#0f172a' }}>
                      INV-{String(viewingInvoice.invoice_id).padStart(5, '0')}
                    </h1>
                    <span style={{ ...styles.badge, ...getStatusBadgeStyle(viewingInvoice.status) }}>
                      {viewingInvoice.status}
                    </span>
                    <span style={{
                      ...styles.badge,
                      background: viewingInvoice.invoice_type === 'Proforma' ? '#fef3c7' : '#f1f5f9',
                      color: viewingInvoice.invoice_type === 'Proforma' ? '#b45309' : '#334155',
                      border: `1px solid ${viewingInvoice.invoice_type === 'Proforma' ? '#fcd34d' : '#cbd5e1'}`
                    }}>
                      {viewingInvoice.invoice_type === 'Proforma' ? 'Proforma Invoice (Advance)' : 'Standard Tax Invoice'}
                    </span>
                  </div>

                  <p style={{ margin: 0, color: '#475569', fontSize: '14px' }}>
                    <strong>Client:</strong> {viewingInvoice.job?.loe?.company?.name || 'N/A'} |{' '}
                    <strong>Issued:</strong> {viewingInvoice.issued_date ? new Date(viewingInvoice.issued_date).toLocaleDateString() : 'N/A'} |{' '}
                    <strong>Due Date:</strong> {viewingInvoice.due_date ? new Date(viewingInvoice.due_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>
                    Outstanding Balance Due
                  </span>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '800',
                    color: Math.max(0, Number(viewingInvoice.total_amount || 0) - Number(viewingInvoice.paid_amount || 0)) > 0 ? '#e11d48' : '#059669'
                  }}>
                    {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                    {Math.max(0, Number(viewingInvoice.total_amount || 0) - Number(viewingInvoice.paid_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* 4 Financial KPI Cards */}
              <div style={styles.kpiGrid}>
                <div style={styles.kpiCard}>
                  <span style={styles.kpiLabel}>Total Invoiced</span>
                  <span style={styles.kpiVal}>
                    {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                    {Number(viewingInvoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={styles.kpiCard}>
                  <span style={styles.kpiLabel}>Total Paid</span>
                  <span style={{ ...styles.kpiVal, color: '#059669' }}>
                    {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                    {Number(viewingInvoice.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={styles.kpiCard}>
                  <span style={styles.kpiLabel}>Balance Remaining</span>
                  <span style={{ ...styles.kpiVal, color: Math.max(0, Number(viewingInvoice.total_amount || 0) - Number(viewingInvoice.paid_amount || 0)) > 0 ? '#e11d48' : '#059669' }}>
                    {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                    {Math.max(0, Number(viewingInvoice.total_amount || 0) - Number(viewingInvoice.paid_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div style={styles.kpiCard}>
                  <span style={styles.kpiLabel}>Collection Progress</span>
                  {(() => {
                    const total = Number(viewingInvoice.total_amount || 0);
                    const paid = Number(viewingInvoice.paid_amount || 0);
                    const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 'bold', color: '#0f172a', marginBottom: '4px' }}>
                          <span>{pct}% Settled</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? '#059669' : '#0284c7' }} />
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* TAB CONTENT: A) Breakdown & Ledger OR B) Official Document Preview */}
            {detailSubTab === 'breakdown' ? (
              <div>
                {/* Two Column Details */}
                <div style={styles.twoCol}>
                  <div style={styles.card}>
                    <h3 style={styles.cardHeading}>Billed Client Details</h3>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Company Name</span>
                      <span style={styles.rowVal}>{viewingInvoice.job?.loe?.company?.name || 'N/A'}</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>{viewingInvoice.job?.loe?.company?.client_type === 'Individual' ? 'NIC Number' : 'Registration No'}</span>
                      <span style={styles.rowVal}>{viewingInvoice.job?.loe?.company?.reg_number || 'N/A'}</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>TIN Number</span>
                      <span style={styles.rowVal}>{viewingInvoice.job?.loe?.company?.tin_number || 'N/A'}</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Contact Email</span>
                      <span style={styles.rowVal}>{viewingInvoice.job?.loe?.company?.email || 'N/A'}</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Contact Phone</span>
                      <span style={styles.rowVal}>{viewingInvoice.job?.loe?.company?.phone_number || 'N/A'}</span>
                    </div>
                  </div>

                  <div style={styles.card}>
                    <h3 style={styles.cardHeading}>Engagement &amp; Remittance Details</h3>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Contract / LOE Ref</span>
                      <span style={styles.rowVal}>LOE-{String(viewingInvoice.job?.loe_id || '').padStart(5, '0')}</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Billing Routine</span>
                      <span style={styles.rowVal}>{viewingInvoice.job?.loe?.billing_frequency || 'One-Time'}</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Bank Remittance</span>
                      <span style={styles.rowVal}>Commercial Bank of Ceylon PLC</span>
                    </div>
                    <div style={styles.rowItem}>
                      <span style={styles.rowLabel}>Account Number</span>
                      <span style={styles.rowVal}>1000185934 (Frontier Advisory)</span>
                    </div>
                    {viewingInvoice.notes && (
                      <div style={styles.rowItem}>
                        <span style={styles.rowLabel}>Invoice Notes</span>
                        <span style={styles.rowVal}>{viewingInvoice.notes}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Deliverables / Scope Table */}
                <div style={{ ...styles.card, marginTop: '20px' }}>
                  <h3 style={styles.cardHeading}>Services &amp; Deliverables Breakdown</h3>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.theadRow}>
                        <th style={styles.th}>#</th>
                        <th style={styles.th}>Service / Deliverable</th>
                        <th style={styles.th}>Department</th>
                        <th style={styles.th}>Billing Routine</th>
                        <th style={{ ...styles.th, textAlign: 'right' }}>Amount ({viewingInvoice.job?.loe?.currency || 'LKR'})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewingInvoice.job?.loe?.loe_items || []).length > 0 ? (
                        viewingInvoice.job.loe.loe_items.map((item, idx) => (
                          <tr key={item.loe_item_id || idx} style={styles.tbodyRow}>
                            <td style={styles.td}>{idx + 1}</td>
                            <td style={styles.td}>
                              <div style={{ fontWeight: '600', color: '#0f172a' }}>{item.service?.name || 'Deliverable'}</div>
                              {item.custom_scope && (
                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{item.custom_scope}</div>
                              )}
                            </td>
                            <td style={styles.td}>{item.service?.department?.name || 'General'}</td>
                            <td style={styles.td}>{item.service?.billing_type || viewingInvoice.job?.loe?.billing_frequency || 'One-Time'}</td>
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold' }}>
                              {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr style={styles.tbodyRow}>
                          <td style={styles.td}>1</td>
                          <td style={styles.td}>
                            <div style={{ fontWeight: '600' }}>{viewingInvoice.notes || 'Professional Advisory Services'}</div>
                          </td>
                          <td style={styles.td}>Advisory</td>
                          <td style={styles.td}>One-Time</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold' }}>
                            {Number(viewingInvoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Payment History Ledger Table */}
                <div style={{ ...styles.card, marginTop: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Payment History &amp; Collection Ledger</h3>
                    {canManage && viewingInvoice.status !== 'Paid' && (
                      <button
                        type="button"
                        onClick={(e) => openPaymentModal(viewingInvoice, e)}
                        style={styles.smallActionBtn}
                      >
                        + Record Payment
                      </button>
                    )}
                  </div>

                  {(viewingInvoice.payments || []).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '6px' }}>
                      No payments recorded yet for this invoice.
                    </div>
                  ) : (
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.theadRow}>
                          <th style={styles.th}>Date</th>
                          <th style={styles.th}>Payment Method</th>
                          <th style={styles.th}>Reference No</th>
                          <th style={styles.th}>Notes</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Amount Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingInvoice.payments.map((p) => (
                          <tr key={p.payment_id} style={styles.tbodyRow}>
                            <td style={styles.td}>{p.payment_date ? new Date(p.payment_date).toLocaleDateString() : 'N/A'}</td>
                            <td style={styles.td}>
                              <span style={styles.methodBadge}>{p.payment_method || 'Bank Transfer'}</span>
                            </td>
                            <td style={styles.td}>{p.reference_no || '—'}</td>
                            <td style={styles.td}>{p.notes || '—'}</td>
                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>
                              + {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                              {Number(p.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            ) : (
              /* TAB CONTENT: B) Official Document Preview with Standard Company Logo Banner */
              <div style={styles.documentPreviewCard}>
                <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                  <img
                    src="/frontier_logo_banner.png"
                    alt="Frontier Advisory Banner"
                    style={{ maxWidth: '380px', height: 'auto', display: 'inline-block' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1.5px solid #000', paddingBottom: '8px', marginBottom: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '16px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {viewingInvoice.invoice_type === 'Proforma' ? 'PROFORMA INVOICE (ADVANCE PAYMENT)' : 'INVOICE'}
                    </h2>
                    <div style={{ fontSize: '13px', marginTop: '3px' }}>
                      Invoice No: <strong>INV-{String(viewingInvoice.invoice_id).padStart(5, '0')}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ ...styles.badge, ...getStatusBadgeStyle(viewingInvoice.status) }}>
                      {viewingInvoice.status.toUpperCase()}
                    </span>
                    <div style={{ fontSize: '13px', marginTop: '4px' }}>
                      Currency: <strong>{viewingInvoice.job?.loe?.currency || 'LKR'}</strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ flex: 1, border: '1px solid #000', padding: '10px 12px', background: '#fafafa', fontSize: '13px', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '6px' }}>Billed To:</div>
                    <div><strong>{viewingInvoice.job?.loe?.company?.name || 'N/A'}</strong></div>
                    <div>{viewingInvoice.job?.loe?.company?.client_type === 'Individual' ? 'NIC' : 'Reg No'}: {viewingInvoice.job?.loe?.company?.reg_number || 'N/A'}</div>
                    <div>TIN: {viewingInvoice.job?.loe?.company?.tin_number || 'N/A'}</div>
                    <div>Email: {viewingInvoice.job?.loe?.company?.email || 'N/A'}</div>
                    <div>Phone: {viewingInvoice.job?.loe?.company?.phone_number || 'N/A'}</div>
                  </div>

                  <div style={{ flex: 1, border: '1px solid #000', padding: '10px 12px', background: '#fafafa', fontSize: '13px', lineHeight: '1.4' }}>
                    <div style={{ fontWeight: 'bold', textDecoration: 'underline', marginBottom: '6px' }}>Invoice Details:</div>
                    <div><strong>Issue Date:</strong> {viewingInvoice.issued_date ? new Date(viewingInvoice.issued_date).toLocaleDateString() : 'N/A'}</div>
                    <div><strong>Due Date:</strong> {viewingInvoice.due_date ? new Date(viewingInvoice.due_date).toLocaleDateString() : 'N/A'}</div>
                    <div><strong>Payment Terms:</strong> 15 Days from Invoice Date</div>
                  </div>
                </div>

                {viewingInvoice.notes && (
                  <div style={{ border: '1px solid #000', padding: '8px 12px', background: '#fafafa', fontSize: '13px', marginBottom: '14px' }}>
                    <strong>Notes / Terms:</strong> {viewingInvoice.notes}
                  </div>
                )}

                <table style={{ width: '100%', borderCollapse: 'collapse', border: '1.5px solid #000', marginBottom: '14px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #000' }}>
                      <th style={{ border: '1px solid #000', padding: '6px 10px', width: '5%', textAlign: 'center' }}>#</th>
                      <th style={{ border: '1px solid #000', padding: '6px 10px', width: '55%', textAlign: 'left' }}>Service &amp; Scope of Work</th>
                      <th style={{ border: '1px solid #000', padding: '6px 10px', width: '20%', textAlign: 'center' }}>Billing Routine</th>
                      <th style={{ border: '1px solid #000', padding: '6px 10px', width: '20%', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewingInvoice.job?.loe?.loe_items || []).length > 0 ? (
                      viewingInvoice.job.loe.loe_items.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                          <td style={{ border: '1px solid #000', padding: '6px 10px' }}>
                            <strong>{item.service?.name || 'Deliverable'}</strong>
                            {item.custom_scope && <div style={{ fontSize: '11px', color: '#475569' }}>{item.custom_scope}</div>}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center' }}>
                            {item.service?.billing_type || viewingInvoice.job?.loe?.billing_frequency || 'One-Time'}
                          </td>
                          <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                            {Number(item.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center', fontWeight: 'bold' }}>1</td>
                        <td style={{ border: '1px solid #000', padding: '6px 10px' }}>
                          <strong>{viewingInvoice.notes || 'Professional Advisory Services'}</strong>
                        </td>
                        <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'center' }}>One-Time</td>
                        <td style={{ border: '1px solid #000', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                          {Number(viewingInvoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Total and Balance Due */}
                <div style={{ border: '1.5px solid #000', background: '#fafafa', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>Please remit payment in <strong>{viewingInvoice.job?.loe?.currency || 'LKR'}</strong></div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                      Total Invoiced: {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                      {Number(viewingInvoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    {Number(viewingInvoice.paid_amount || 0) > 0 && (
                      <div style={{ fontSize: '13px', color: '#059669', marginTop: '3px' }}>
                        Paid to Date: - {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                        {Number(viewingInvoice.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: Math.max(0, Number(viewingInvoice.total_amount || 0) - Number(viewingInvoice.paid_amount || 0)) > 0 ? '#b91c1c' : '#059669', marginTop: '3px' }}>
                      Remaining Balance: {viewingInvoice.job?.loe?.currency || 'Rs.'}{' '}
                      {Math.max(0, Number(viewingInvoice.total_amount || 0) - Number(viewingInvoice.paid_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Remittance Box */}
                <div style={{ border: '1px dashed #64748b', background: '#ffffff', padding: '10px 14px', fontSize: '12px', lineHeight: '1.45' }}>
                  <strong>Bank Remittance Details:</strong><br />
                  Bank: Commercial Bank of Ceylon PLC | Branch: Colombo 04 Branch<br />
                  Account Name: Frontier Advisory (Private) Limited | Account No: 1000185934<br />
                  Please quote Invoice Reference <strong>INV-{String(viewingInvoice.invoice_id).padStart(5, '0')}</strong> with remittance confirmation.
                </div>

                {/* System Generated Electronic Invoice Notice */}
                <div style={{ marginTop: '18px', textAlign: 'center', fontFamily: "'Times New Roman', Times, serif", fontSize: '12px', fontStyle: 'italic', color: '#64748b' }}>
                  This invoice is electronically generated by an automated system and is valid without a signature.
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ============================================================
              MODE B: MAIN DIRECTORY & REPORTS SCREEN
             ============================================================ */
          <div>
            {/* Header Row */}
            <div style={styles.headerRow}>
              <div>
                <h1 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: '26px' }}>
                  Invoices &amp; Billing Management
                </h1>
                <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                  Manage client billings, proforma advance requests, collection payments, and aging reports.
                </p>
              </div>

              {/* Top Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                {/* Main Tab Switch: Invoices Directory vs Reports */}
                <div style={styles.segmentedToggle}>
                  <button
                    type="button"
                    onClick={() => setActiveMainTab('invoices')}
                    style={{
                      ...styles.segmentBtn,
                      background: activeMainTab === 'invoices' ? '#0284c7' : 'transparent',
                      color: activeMainTab === 'invoices' ? '#ffffff' : '#475569',
                      fontWeight: activeMainTab === 'invoices' ? 'bold' : 'normal'
                    }}
                  >
                    Invoices Directory
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveMainTab('reports')}
                    style={{
                      ...styles.segmentBtn,
                      background: activeMainTab === 'reports' ? '#0284c7' : 'transparent',
                      color: activeMainTab === 'reports' ? '#ffffff' : '#475569',
                      fontWeight: activeMainTab === 'reports' ? 'bold' : 'normal'
                    }}
                  >
                    Financial Reports
                  </button>
                </div>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => openProformaModal()}
                    style={styles.primaryTopBtn}
                  >
                    + Create Proforma Invoice
                  </button>
                )}
              </div>
            </div>

            {/* TAB A: INVOICES DIRECTORY */}
            {activeMainTab === 'invoices' ? (
              <div>
                {/* View Switcher and Count Bar */}
                <div style={styles.topControlRow}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={styles.countBadge}>
                      {filteredInvoices.length} {filteredInvoices.length === 1 ? 'Invoice' : 'Invoices'}
                    </span>

                    {/* View Switcher: List View (Table) vs Grid View (Cards) */}
                    <div style={styles.viewToggleGroup}>
                      <button
                        type="button"
                        onClick={() => setViewMode('list')}
                        style={{
                          ...styles.viewToggleBtn,
                          background: viewMode === 'list' ? '#0284c7' : '#ffffff',
                          color: viewMode === 'list' ? '#ffffff' : '#475569',
                          borderColor: viewMode === 'list' ? '#0284c7' : '#cbd5e1'
                        }}
                      >
                        List View (Table)
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('grid')}
                        style={{
                          ...styles.viewToggleBtn,
                          background: viewMode === 'grid' ? '#0284c7' : '#ffffff',
                          color: viewMode === 'grid' ? '#ffffff' : '#475569',
                          borderColor: viewMode === 'grid' ? '#0284c7' : '#cbd5e1'
                        }}
                      >
                        Grid View (Cards)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Bar */}
                <div style={styles.filterBar}>
                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Invoice Number</label>
                    <input
                      type="text"
                      placeholder="Search # (e.g. 1 or INV-00001)..."
                      value={filterInvoiceNo}
                      onChange={(e) => setFilterInvoiceNo(e.target.value)}
                      style={styles.filterInput}
                    />
                  </div>

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

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Department</label>
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

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Payment Status</label>
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      style={styles.filterSelect}
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="Not Paid">Not Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Paid">Paid</option>
                    </select>
                  </div>

                  <div style={styles.filterField}>
                    <label style={styles.filterLabel}>Invoice Type</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      style={styles.filterSelect}
                    >
                      <option value="ALL">All Types</option>
                      <option value="Standard">Standard Invoice</option>
                      <option value="Proforma">Proforma (Advance)</option>
                    </select>
                  </div>

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

                {/* Invoices List / Grid Display */}
                {loading ? (
                  <div style={{ ...styles.emptyCard, background: '#ffffff', padding: '40px 20px', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <BlobLoader message="Loading invoices & financial records..." size="large" />
                </div>
                ) : filteredInvoices.length === 0 ? (
                  <div style={styles.emptyCard}>No invoices match your filter criteria.</div>
                ) : viewMode === 'list' ? (
                  /* ============================================================
                      VIEW 1: LIST VIEW (TABLE)
                     ============================================================ */
                  <div style={styles.tableCard}>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.theadRow}>
                          <th style={{ ...styles.th, minWidth: '115px' }}>Invoice #</th>
                          <th style={{ ...styles.th, textAlign: 'center', minWidth: '95px' }}>Type</th>
                          <th style={{ ...styles.th, minWidth: '180px' }}>Company / Client</th>
                          <th style={{ ...styles.th, minWidth: '110px' }}>Department</th>
                          <th style={{ ...styles.th, textAlign: 'right', minWidth: '110px' }}>Total Amount</th>
                          <th style={{ ...styles.th, textAlign: 'right', minWidth: '100px' }}>Paid Amount</th>
                          <th style={{ ...styles.th, textAlign: 'right', minWidth: '110px' }}>Balance Due</th>
                          <th style={{ ...styles.th, minWidth: '100px', whiteSpace: 'nowrap' }}>Due Date</th>
                          <th style={{ ...styles.th, textAlign: 'center', whiteSpace: 'nowrap', minWidth: '105px' }}>Status</th>
                          <th style={{ ...styles.th, textAlign: 'center', minWidth: '140px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map((inv) => {
                          const company = inv.job?.loe?.company;
                          const currencyCode = inv.job?.loe?.currency || 'LKR';
                          const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
                          const totalAmt = Number(inv.total_amount || 0);
                          const paidAmt = Number(inv.paid_amount || 0);
                          const balanceDue = Math.max(0, totalAmt - paidAmt);
                          const isProforma = inv.invoice_type === 'Proforma';
                          const loeItems = inv.job?.loe?.loe_items || [];
                          const deptNames = Array.from(
                            new Set(loeItems.map((item) => item.service?.department?.name).filter(Boolean))
                          );

                          return (
                            <tr
                              key={inv.invoice_id}
                              style={styles.tbodyRow}
                              onClick={() => setViewingInvoice(inv)}
                            >
                              <td style={styles.td}>
                                <div style={{ fontWeight: 'bold', color: '#0284c7' }}>
                                  INV-{String(inv.invoice_id).padStart(5, '0')}
                                </div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : ''}
                                </div>
                              </td>

                              <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  ...styles.badge,
                                  background: isProforma ? '#fef3c7' : '#f1f5f9',
                                  color: isProforma ? '#b45309' : '#475569',
                                  border: `1px solid ${isProforma ? '#fcd34d' : '#cbd5e1'}`
                                }}>
                                  {isProforma ? 'Proforma' : 'Standard'}
                                </span>
                              </td>

                              <td style={styles.td}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{company?.name || 'N/A'}</div>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {company?.reg_number ? `${company?.client_type === 'Individual' ? 'NIC' : 'Reg'}: ${company.reg_number}` : ''}
                                </div>
                              </td>

                              <td style={styles.td}>
                                <div style={{ fontSize: '12px', color: '#334155' }}>
                                  {deptNames.length > 0 ? deptNames.join(', ') : 'Advisory'}
                                </div>
                              </td>

                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {symbol} {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td style={{ ...styles.td, textAlign: 'right', color: '#059669', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                {symbol} {paidAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td style={{
                                ...styles.td,
                                textAlign: 'right',
                                fontWeight: 'bold',
                                color: balanceDue > 0 ? '#e11d48' : '#059669',
                                whiteSpace: 'nowrap'
                              }}>
                                {symbol} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              <td style={{ ...styles.td, whiteSpace: 'nowrap' }}>
                                {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                              </td>

                              {/* Clean, well-spaced Status Badge (No awkward vertical line breaks) */}
                              <td style={{ ...styles.td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span style={{
                                  ...styles.badge,
                                  ...getStatusBadgeStyle(inv.status),
                                  minWidth: '85px',
                                  padding: '5px 12px'
                                }}>
                                  {inv.status}
                                </span>
                              </td>

                              <td style={{ ...styles.td, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => setViewingInvoice(inv)}
                                    style={styles.tblViewBtn}
                                    title="View Invoice Details"
                                  >
                                    View
                                  </button>

                                  {canManage && inv.status !== 'Paid' && (
                                    <button
                                      type="button"
                                      onClick={(e) => openPaymentModal(inv, e)}
                                      style={styles.tblPayBtn}
                                      title="Receive Payment"
                                    >
                                      Pay
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onMouseEnter={() => prewarmInvoicePdf(inv.invoice_id)}
                                    onClick={() => handleDownloadPdf(inv.invoice_id)}
                                    disabled={downloadingId === inv.invoice_id}
                                    style={styles.tblPdfBtn}
                                    title="Download PDF"
                                  >
                                    PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  /* ============================================================
                      VIEW 2: GRID VIEW (CARDS)
                     ============================================================ */
                  <div style={styles.grid}>
                    {filteredInvoices.map((inv) => {
                      const company = inv.job?.loe?.company;
                      const currencyCode = inv.job?.loe?.currency || 'LKR';
                      const symbol = CURRENCY_SYMBOLS[currencyCode] || currencyCode;
                      const isPaid = inv.status === 'Paid';
                      const isProforma = inv.invoice_type === 'Proforma';
                      const totalAmt = Number(inv.total_amount || 0);
                      const paidAmt = Number(inv.paid_amount || 0);
                      const balanceDue = Math.max(0, totalAmt - paidAmt);

                      const loeItems = inv.job?.loe?.loe_items || [];
                      const deptNames = Array.from(
                        new Set(loeItems.map((item) => item.service?.department?.name).filter(Boolean))
                      );

                      return (
                        <div
                          key={inv.invoice_id}
                          style={styles.invoiceCard}
                          onClick={() => setViewingInvoice(inv)}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                                INV-{String(inv.invoice_id).padStart(5, '0')}
                              </h3>
                              <span style={{
                                ...styles.badge,
                                fontSize: '10px',
                                padding: '2px 8px',
                                marginTop: '4px',
                                display: 'inline-flex',
                                background: isProforma ? '#fef3c7' : '#f1f5f9',
                                color: isProforma ? '#b45309' : '#475569',
                                border: `1px solid ${isProforma ? '#fcd34d' : '#cbd5e1'}`
                              }}>
                                {isProforma ? 'Proforma (Advance)' : 'Standard'}
                              </span>
                            </div>

                            <span style={{ ...styles.badge, ...getStatusBadgeStyle(inv.status), minWidth: '85px', padding: '5px 12px' }}>
                              {inv.status}
                            </span>
                          </div>

                          <p style={{ margin: '12px 0 2px', fontSize: '14px' }}>
                            <strong>Company:</strong> {company?.name || 'N/A'}
                          </p>

                          {deptNames.length > 0 && (
                            <p style={{ margin: '2px 0 6px', fontSize: '12px', color: '#64748b' }}>
                              <strong>Dept:</strong> {deptNames.join(', ')}
                            </p>
                          )}

                          {/* Financial Summary Inside Card */}
                          <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', margin: '8px 0', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', color: '#475569' }}>Total Invoiced:</span>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>
                                {symbol} {totalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <span style={{ fontSize: '12px', color: '#059669' }}>Paid to Date:</span>
                              <span style={{ fontSize: '13px', fontWeight: '600', color: '#059669' }}>
                                {symbol} {paidAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Balance Due:</span>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: balanceDue > 0 ? '#e11d48' : '#059669' }}>
                                {symbol} {balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </div>
                          </div>

                          <p style={{ margin: '4px 0', fontSize: '12px', color: '#64748b' }}>
                            <strong>Issued:</strong> {inv.issued_date ? new Date(inv.issued_date).toLocaleDateString() : 'N/A'} |{' '}
                            <strong>Due:</strong> {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                          </p>

                          <div style={styles.actionColumn} onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                type="button"
                                onClick={() => setViewingInvoice(inv)}
                                style={{ ...styles.actionBtn, background: '#0284c7' }}
                              >
                                View Details
                              </button>

                              {canManage && !isPaid && (
                                <button
                                  type="button"
                                  onClick={(e) => openPaymentModal(inv, e)}
                                  style={{ ...styles.actionBtn, background: '#10b981' }}
                                >
                                  Receive Payment
                                </button>
                              )}

                              <button
                                type="button"
                                onMouseEnter={() => prewarmInvoicePdf(inv.invoice_id)}
                                onClick={() => handleDownloadPdf(inv.invoice_id)}
                                disabled={downloadingId === inv.invoice_id}
                                style={{ ...styles.actionBtn, background: '#475569' }}
                              >
                                {downloadingId === inv.invoice_id ? 'PDF...' : 'PDF'}
                              </button>
                            </div>

                            {!isPaid && canManage && (
                              <button
                                type="button"
                                onClick={() => handleSendReminder(inv.invoice_id)}
                                disabled={remindingId === inv.invoice_id}
                                style={styles.remindBtn}
                              >
                                {remindingId === inv.invoice_id ? 'Sending Reminder...' : 'Send Reminder Email'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* ============================================================
                  TAB B: FINANCIAL REPORTS & AGING ANALYTICS
                 ============================================================ */
              <div>
                {/* Reports Summary KPI Bar */}
                <div style={styles.kpiGrid}>
                  <div style={styles.kpiCard}>
                    <span style={styles.kpiLabel}>Total Invoiced Revenue</span>
                    <span style={styles.kpiVal}>
                      Rs. {reportsData.totalInvoicedSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={styles.kpiCard}>
                    <span style={styles.kpiLabel}>Total Collections Received</span>
                    <span style={{ ...styles.kpiVal, color: '#059669' }}>
                      Rs. {reportsData.totalPaidSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={styles.kpiCard}>
                    <span style={styles.kpiLabel}>Total Outstanding Receivables</span>
                    <span style={{ ...styles.kpiVal, color: '#e11d48' }}>
                      Rs. {reportsData.totalBalanceSum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div style={styles.kpiCard}>
                    <span style={styles.kpiLabel}>Overdue Invoices Count</span>
                    <span style={{ ...styles.kpiVal, color: '#d97706' }}>
                      {reportsData.overdueCountSum} Overdue
                    </span>
                  </div>
                </div>

                {/* Report Type Selector Tabs */}
                <div style={{ display: 'flex', gap: '10px', margin: '24px 0 16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setReportSubTab('clients')}
                    style={{
                      ...styles.subTabBtn,
                      borderBottom: reportSubTab === 'clients' ? '2px solid #0284c7' : 'none',
                      color: reportSubTab === 'clients' ? '#0284c7' : '#64748b',
                      fontWeight: reportSubTab === 'clients' ? 'bold' : 'normal'
                    }}
                  >
                    Clients Due Report ({reportsData.clientsList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportSubTab('departments')}
                    style={{
                      ...styles.subTabBtn,
                      borderBottom: reportSubTab === 'departments' ? '2px solid #0284c7' : 'none',
                      color: reportSubTab === 'departments' ? '#0284c7' : '#64748b',
                      fontWeight: reportSubTab === 'departments' ? 'bold' : 'normal'
                    }}
                  >
                    Department Due Report ({reportsData.departmentList.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setReportSubTab('aging')}
                    style={{
                      ...styles.subTabBtn,
                      borderBottom: reportSubTab === 'aging' ? '2px solid #0284c7' : 'none',
                      color: reportSubTab === 'aging' ? '#0284c7' : '#64748b',
                      fontWeight: reportSubTab === 'aging' ? 'bold' : 'normal'
                    }}
                  >
                    AR Invoice Aging Report
                  </button>
                </div>

                {/* REPORT 1: CLIENTS DUE REPORT */}
                {reportSubTab === 'clients' && (
                  <div style={styles.tableCard}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                      <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>Clients Accounts Receivable &amp; Outstanding Dues</h3>
                      <input
                        type="text"
                        placeholder="Filter client name..."
                        value={clientReportSearch}
                        onChange={(e) => setClientReportSearch(e.target.value)}
                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', width: '220px' }}
                      />
                    </div>

                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.theadRow}>
                          <th style={styles.th}>Client / Company Name</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Invoices</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Overdue Invoices</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Total Invoiced (Rs.)</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Total Received (Rs.)</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Balance Due (Rs.)</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsData.clientsList
                          .filter((c) => !clientReportSearch || c.company_name.toLowerCase().includes(clientReportSearch.toLowerCase()))
                          .map((client) => (
                            <tr key={client.company_id} style={styles.tbodyRow}>
                              <td style={styles.td}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{client.company_name}</div>
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>{client.invoice_count}</td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <span style={{
                                  ...styles.badge,
                                  background: client.overdue_count > 0 ? '#fff1f2' : '#ecfdf5',
                                  color: client.overdue_count > 0 ? '#e11d48' : '#059669'
                                }}>
                                  {client.overdue_count} Overdue
                                </span>
                              </td>
                              <td style={{ ...styles.td, textAlign: 'right' }}>
                                {client.total_invoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                                {client.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: client.balance_due > 0 ? '#e11d48' : '#059669' }}>
                                {client.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <span style={{
                                  ...styles.badge,
                                  background: client.balance_due <= 0 ? '#ecfdf5' : client.overdue_count > 0 ? '#fff1f2' : '#fffbeb',
                                  color: client.balance_due <= 0 ? '#059669' : client.overdue_count > 0 ? '#e11d48' : '#d97706'
                                }}>
                                  {client.balance_due <= 0 ? 'Settled' : client.overdue_count > 0 ? 'Overdue Dues' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* REPORT 2: DEPARTMENT DUE REPORT */}
                {reportSubTab === 'departments' && (
                  <div style={styles.tableCard}>
                    <h3 style={{ margin: '0 0 14px', fontSize: '17px', color: '#0f172a' }}>Department Revenue &amp; Collections Breakdown</h3>
                    <table style={styles.table}>
                      <thead>
                        <tr style={styles.theadRow}>
                          <th style={styles.th}>Department</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Engagements</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Total Invoiced (Rs.)</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Total Collections (Rs.)</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Outstanding Dues (Rs.)</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Collection Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportsData.departmentList.map((dept) => {
                          const rate = dept.total_invoiced > 0 ? Math.round((dept.total_paid / dept.total_invoiced) * 100) : 0;
                          return (
                            <tr key={dept.department_id} style={styles.tbodyRow}>
                              <td style={styles.td}>
                                <div style={{ fontWeight: '600', color: '#0f172a' }}>{dept.department_name}</div>
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>{dept.invoice_count}</td>
                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>
                                {dept.total_invoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#059669', fontWeight: '600' }}>
                                {dept.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'right', color: '#e11d48', fontWeight: 'bold' }}>
                                {dept.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{rate}%</span>
                                  <div style={{ width: '60px', height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ width: `${rate}%`, height: '100%', background: rate >= 100 ? '#059669' : '#0284c7' }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* REPORT 3: AR AGING REPORT */}
                {reportSubTab === 'aging' && (
                  <div>
                    {/* Aging Buckets Overview Cards */}
                    <div style={styles.agingGrid}>
                      <div
                        style={{ ...styles.agingCard, borderLeft: '4px solid #10b981', cursor: 'pointer' }}
                        onClick={() => setAgingBucketFilter(agingBucketFilter === 'current' ? 'ALL' : 'current')}
                      >
                        <span style={styles.agingLabel}>Current (0-30 Days)</span>
                        <div style={styles.agingAmount}>
                          Rs. {reportsData.aging.current.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span style={styles.agingCount}>{reportsData.aging.current.count} Invoices</span>
                      </div>

                      <div
                        style={{ ...styles.agingCard, borderLeft: '4px solid #f59e0b', cursor: 'pointer' }}
                        onClick={() => setAgingBucketFilter(agingBucketFilter === 'days_31_60' ? 'ALL' : 'days_31_60')}
                      >
                        <span style={styles.agingLabel}>31-60 Days Overdue</span>
                        <div style={{ ...styles.agingAmount, color: '#d97706' }}>
                          Rs. {reportsData.aging.days_31_60.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span style={styles.agingCount}>{reportsData.aging.days_31_60.count} Invoices</span>
                      </div>

                      <div
                        style={{ ...styles.agingCard, borderLeft: '4px solid #ea580c', cursor: 'pointer' }}
                        onClick={() => setAgingBucketFilter(agingBucketFilter === 'days_61_90' ? 'ALL' : 'days_61_90')}
                      >
                        <span style={styles.agingLabel}>61-90 Days Overdue</span>
                        <div style={{ ...styles.agingAmount, color: '#ea580c' }}>
                          Rs. {reportsData.aging.days_61_90.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span style={styles.agingCount}>{reportsData.aging.days_61_90.count} Invoices</span>
                      </div>

                      <div
                        style={{ ...styles.agingCard, borderLeft: '4px solid #e11d48', cursor: 'pointer' }}
                        onClick={() => setAgingBucketFilter(agingBucketFilter === 'days_90_plus' ? 'ALL' : 'days_90_plus')}
                      >
                        <span style={styles.agingLabel}>90+ Days (Critical)</span>
                        <div style={{ ...styles.agingAmount, color: '#e11d48' }}>
                          Rs. {reportsData.aging.days_90_plus.balance_due.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <span style={styles.agingCount}>{reportsData.aging.days_90_plus.count} Invoices</span>
                      </div>
                    </div>

                    {/* Aging Table with Bucket Filter */}
                    <div style={{ ...styles.tableCard, marginTop: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>Aging Invoices Detailed Ledger</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Filter Aging Bucket:</label>
                          <select
                            value={agingBucketFilter}
                            onChange={(e) => setAgingBucketFilter(e.target.value)}
                            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                          >
                            <option value="ALL">All Aging Buckets</option>
                            <option value="current">Current (0-30 Days)</option>
                            <option value="days_31_60">31-60 Days Overdue</option>
                            <option value="days_61_90">61-90 Days Overdue</option>
                            <option value="days_90_plus">90+ Days Overdue</option>
                          </select>
                        </div>
                      </div>

                      {(() => {
                        let displayedInvoices = [];
                        if (agingBucketFilter === 'ALL') {
                          displayedInvoices = [
                            ...reportsData.aging.days_90_plus.invoices,
                            ...reportsData.aging.days_61_90.invoices,
                            ...reportsData.aging.days_31_60.invoices,
                            ...reportsData.aging.current.invoices
                          ];
                        } else {
                          displayedInvoices = reportsData.aging[agingBucketFilter]?.invoices || [];
                        }

                        if (displayedInvoices.length === 0) {
                          return (
                            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                              No invoices found in the selected aging criteria.
                            </div>
                          );
                        }

                        return (
                          <table style={styles.table}>
                            <thead>
                              <tr style={styles.theadRow}>
                                <th style={styles.th}>Invoice #</th>
                                <th style={styles.th}>Client</th>
                                <th style={styles.th}>Due Date</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Overdue Days</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Aging Category</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Total Invoiced</th>
                                <th style={{ ...styles.th, textAlign: 'right' }}>Balance Due</th>
                                <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayedInvoices.map((inv) => (
                                <tr key={inv.invoice_id} style={styles.tbodyRow}>
                                  <td style={styles.td}>
                                    <div style={{ fontWeight: 'bold', color: '#0284c7' }}>
                                      INV-{String(inv.invoice_id).padStart(5, '0')}
                                    </div>
                                  </td>
                                  <td style={styles.td}>{inv.job?.loe?.company?.name || 'Client'}</td>
                                  <td style={styles.td}>
                                    {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'center', fontWeight: 'bold', color: inv.diffDays > 0 ? '#e11d48' : '#059669' }}>
                                    {inv.diffDays > 0 ? `${inv.diffDays} Days Overdue` : 'Not Overdue'}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'center' }}>
                                    <span style={{
                                      ...styles.badge,
                                      background: inv.diffDays > 90 ? '#fff1f2' : inv.diffDays > 60 ? '#ffedd5' : inv.diffDays > 30 ? '#fef3c7' : '#ecfdf5',
                                      color: inv.diffDays > 90 ? '#e11d48' : inv.diffDays > 60 ? '#ea580c' : inv.diffDays > 30 ? '#d97706' : '#059669'
                                    }}>
                                      {inv.diffDays > 90 ? '90+ Days' : inv.diffDays > 60 ? '61-90 Days' : inv.diffDays > 30 ? '31-60 Days' : 'Current'}
                                    </span>
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'right' }}>
                                    Rs. {Number(inv.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 'bold', color: '#e11d48' }}>
                                    Rs. {inv.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'center' }}>
                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => setViewingInvoice(inv)}
                                        style={styles.tblViewBtn}
                                      >
                                        View
                                      </button>
                                      {canManage && (
                                        <button
                                          type="button"
                                          onClick={(e) => openPaymentModal(inv, e)}
                                          style={styles.tblPayBtn}
                                        >
                                          Pay
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleSendReminder(inv.invoice_id)}
                                        style={styles.tblRemindBtn}
                                      >
                                        Remind
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================
            MODAL 1: RECEIVE PAYMENT (FULL OR PARTIAL)
           ============================================================ */}
        {paymentModalInvoice && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalBox}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                  Record Payment: INV-{String(paymentModalInvoice.invoice_id).padStart(5, '0')}
                </h3>
                <button type="button" onClick={closePaymentModal} style={styles.closeModalBtn}>✕</button>
              </div>

              <form onSubmit={handleRecordPayment} style={{ padding: '20px' }}>
                <div style={{ background: '#f8fafc', padding: '12px 14px', borderRadius: '6px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>Client:</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0f172a' }}>
                      {paymentModalInvoice.job?.loe?.company?.name || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', color: '#475569' }}>Total Invoiced:</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold' }}>
                      {paymentModalInvoice.job?.loe?.currency || 'Rs.'}{' '}
                      {Number(paymentModalInvoice.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', color: '#059669' }}>Already Paid:</span>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#059669' }}>
                      {paymentModalInvoice.job?.loe?.currency || 'Rs.'}{' '}
                      {Number(paymentModalInvoice.paid_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#475569' }}>Balance Due:</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#e11d48' }}>
                      {paymentModalInvoice.job?.loe?.currency || 'Rs.'}{' '}
                      {Math.max(0, Number(paymentModalInvoice.total_amount || 0) - Number(paymentModalInvoice.paid_amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Payment Option: Full vs Partial */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.formLabel}>Payment Type</label>
                  <div style={{ display: 'flex', gap: '14px', marginTop: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="paymentType"
                        checked={paymentTypeOption === 'full'}
                        onChange={() => handlePaymentTypeChange('full')}
                      />
                      <span>Full Settlement ({paymentModalInvoice.job?.loe?.currency || 'Rs.'} {Math.max(0, Number(paymentModalInvoice.total_amount || 0) - Number(paymentModalInvoice.paid_amount || 0)).toFixed(2)})</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="paymentType"
                        checked={paymentTypeOption === 'partial'}
                        onChange={() => handlePaymentTypeChange('partial')}
                      />
                      <span>Partial Payment</span>
                    </label>
                  </div>
                </div>

                {/* Amount to Pay */}
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>
                    Payment Amount ({paymentModalInvoice.job?.loe?.currency || 'LKR'}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Math.max(0, Number(paymentModalInvoice.total_amount || 0) - Number(paymentModalInvoice.paid_amount || 0))}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    required
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Payment Date *</label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      required
                      style={styles.formInput}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Payment Method *</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      style={styles.formSelect}
                    >
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Cash">Cash</option>
                      <option value="Credit / Debit Card">Credit / Debit Card</option>
                      <option value="Direct Bank Deposit">Direct Bank Deposit</option>
                      <option value="Online Portal">Online Portal</option>
                    </select>
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Transaction Reference / Cheque No</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-892348, Cheque #00412..."
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Payment Notes / Remarks</label>
                  <input
                    type="text"
                    placeholder="Optional notes or receipt memo..."
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    style={styles.formInput}
                  />
                </div>

                <div style={styles.modalFooter}>
                  <button type="button" onClick={closePaymentModal} style={styles.modalCancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={savingPayment} style={styles.modalSubmitBtn}>
                    {savingPayment ? <BlobLoader inline size={14} light message="Saving Payment..." /> : 'Confirm Payment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================================================
            MODAL 2: CREATE PROFORMA INVOICE FOR ADVANCE PAYMENTS
           ============================================================ */}
        {isProformaModalOpen && (
          <div style={styles.modalOverlay}>
            <div style={styles.modalBox}>
              <div style={styles.modalHeader}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
                  Create Proforma Invoice for Advance Payments
                </h3>
                <button type="button" onClick={() => setIsProformaModalOpen(false)} style={styles.closeModalBtn}>✕</button>
              </div>

              <form onSubmit={handleCreateProformaInvoice} style={{ padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.formLabel}>Derive Advance Request From *</label>
                  <select
                    value={selectedSourceInvoiceId}
                    onChange={(e) => handleSourceInvoiceChange(e.target.value)}
                    required
                    style={styles.formSelect}
                  >
                    <option value="">-- Select Active Invoice / Engagement --</option>
                    {invoices.map((inv) => (
                      <option key={inv.invoice_id} value={inv.invoice_id}>
                        INV-{String(inv.invoice_id).padStart(5, '0')} - {inv.job?.loe?.company?.name || 'Client'} ({inv.job?.loe?.currency || 'Rs.'} {Number(inv.total_amount || 0).toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Advance Payment Percentage Quick Select */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={styles.formLabel}>Advance Payment Percentage</label>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['20', '30', '50', '100', 'custom'].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleAdvancePctChange(pct)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          background: proformaAdvancePct === pct ? '#0284c7' : '#ffffff',
                          color: proformaAdvancePct === pct ? '#ffffff' : '#475569',
                          fontWeight: 'bold',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        {pct === 'custom' ? 'Custom Amount' : `${pct}% Advance`}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={styles.formRow2}>
                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Advance Amount to Request *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={proformaCustomAmount}
                      onChange={(e) => setProformaCustomAmount(e.target.value)}
                      required
                      style={styles.formInput}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.formLabel}>Due Date *</label>
                    <input
                      type="date"
                      value={proformaDueDate}
                      onChange={(e) => setProformaDueDate(e.target.value)}
                      required
                      style={styles.formInput}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Advance Terms &amp; Scope Description</label>
                  <textarea
                    rows="3"
                    value={proformaNotes}
                    onChange={(e) => setProformaNotes(e.target.value)}
                    placeholder="e.g. 30% Mobilization advance payment required prior to commencement of audit services..."
                    style={{ ...styles.formInput, resize: 'vertical' }}
                  />
                </div>

                <div style={styles.modalFooter}>
                  <button type="button" onClick={() => setIsProformaModalOpen(false)} style={styles.modalCancelBtn}>
                    Cancel
                  </button>
                  <button type="submit" disabled={creatingProforma} style={styles.modalSubmitBtn}>
                    {creatingProforma ? <BlobLoader inline size={14} light message="Generating Proforma..." /> : 'Create Proforma Invoice'}
                  </button>
                </div>
              </form>
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
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif",
    marginLeft: 'var(--sidebar-width, 260px)',
    transition: 'margin-left 300ms ease-in-out'
  },
  container: { maxWidth: '1280px', margin: '0 auto', padding: '35px 40px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '15px' },
  topControlRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' },
  countBadge: { background: '#0284c7', color: '#fff', padding: '6px 14px', borderRadius: '18px', fontSize: '12.5px', fontWeight: 'bold' },
  viewToggleGroup: { display: 'inline-flex', borderRadius: '6px', overflow: 'hidden', border: '1px solid #cbd5e1' },
  viewToggleBtn: { padding: '6px 14px', border: 'none', fontSize: '12px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.15s ease' },
  segmentedToggle: { display: 'inline-flex', background: '#e2e8f0', padding: '3px', borderRadius: '8px' },
  segmentBtn: { border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s ease' },
  primaryTopBtn: { background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12.5px', cursor: 'pointer' },

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
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  filterField: { display: 'flex', flexDirection: 'column', gap: '4px', flex: '1', minWidth: '140px' },
  filterLabel: { fontSize: '11.5px', fontWeight: 'bold', color: '#475569' },
  filterInput: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' },
  filterSelect: { padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px', background: '#fff' },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#f8fafc',
    color: '#e11d48',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    height: '35px'
  },

  emptyCard: { background: '#fff', padding: '40px', textAlign: 'center', borderRadius: '8px', color: '#64748b', border: '1px solid #e2e8f0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '20px' },
  invoiceCard: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'box-shadow 0.2s ease' },
  badge: {
    padding: '5px 12px',
    borderRadius: '14px',
    fontSize: '11px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1
  },
  methodBadge: { background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  actionColumn: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' },
  actionBtn: { flex: 1, padding: '8px 10px', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },
  remindBtn: { width: '100%', padding: '8px 10px', background: '#d97706', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' },

  tableCard: { background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px', overflowX: 'auto', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' },
  theadRow: { background: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  th: { padding: '10px 12px', color: '#475569', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' },
  tbodyRow: { borderBottom: '1px solid #f1f5f9', cursor: 'pointer', transition: 'background 0.15s ease' },
  td: { padding: '12px 12px', verticalAlign: 'middle' },
  tblViewBtn: { background: '#0284c7', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  tblPayBtn: { background: '#10b981', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  tblPdfBtn: { background: '#475569', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  tblRemindBtn: { background: '#d97706', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },

  detailsTopBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  backBtn: { background: '#ffffff', color: '#0284c7', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  primaryActionBtn: { background: '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  secondaryActionBtn: { background: '#0284c7', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  remindTopBtn: { background: '#d97706', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  smallActionBtn: { background: '#0284c7', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '5px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer' },

  heroCard: { background: '#ffffff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', marginBottom: '20px', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginTop: '20px' },
  kpiCard: { background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  kpiLabel: { display: 'block', fontSize: '11.5px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' },
  kpiVal: { fontSize: '18px', fontWeight: '800', color: '#0f172a' },

  twoCol: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' },
  card: { background: '#ffffff', borderRadius: '8px', padding: '20px', border: '1px solid #e2e8f0' },
  cardHeading: { margin: '0 0 14px', fontSize: '15px', color: '#0f172a' },
  rowItem: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9', fontSize: '13px' },
  rowLabel: { color: '#64748b', fontWeight: '500' },
  rowVal: { color: '#0f172a', fontWeight: '600', textAlign: 'right' },

  documentPreviewCard: { background: '#ffffff', border: '1px solid #cbd5e1', padding: '36px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', maxWidth: '850px', margin: '0 auto', fontFamily: "'Times New Roman', Times, serif" },

  subTabBtn: { background: 'none', border: 'none', padding: '8px 16px', fontSize: '14px', cursor: 'pointer' },
  agingGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px', marginBottom: '16px' },
  agingCard: { background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)' },
  agingLabel: { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#475569', marginBottom: '4px' },
  agingAmount: { fontSize: '18px', fontWeight: '800', color: '#059669', marginBottom: '4px' },
  agingCount: { fontSize: '11.5px', color: '#64748b' },

  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' },
  modalBox: { background: '#ffffff', width: '100%', maxWidth: '540px', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' },
  closeModalBtn: { background: 'none', border: 'none', fontSize: '18px', color: '#64748b', cursor: 'pointer' },
  formGroup: { marginBottom: '14px' },
  formRow2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  formLabel: { display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#334155', marginBottom: '4px' },
  formInput: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' },
  formSelect: { width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#ffffff', boxSizing: 'border-box' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '16px' },
  modalCancelBtn: { background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },
  modalSubmitBtn: { background: '#0284c7', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' },

  errorBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff1f2', color: '#e11d48', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid #fecdd3' },
  successBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ecfdf5', color: '#059669', padding: '12px 16px', borderRadius: '6px', marginBottom: '16px', fontSize: '13px', border: '1px solid #a7f3d0' },
  dismissBtn: { background: 'none', border: 'none', color: 'inherit', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }
};

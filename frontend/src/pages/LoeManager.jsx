import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { useNavigate, useLocation } from 'react-router-dom';
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

export default function LoeManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();

  const [loes, setLoes] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [services, setServices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [downloadingId, setDownloadingId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    company_id: '',
    type: 'Adhoc',
    billing_frequency: 'One-Time',
    currency: 'LKR',
    start_date: '',
    loe_services: [] 
  });
  
  const [editingId, setEditingId] = useState(null);
  const [editingPreviousStatus, setEditingPreviousStatus] = useState(null);
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');

  // Filter States for LOE List
  const [filterCompany, setFilterCompany] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [filterFrequency, setFilterFrequency] = useState('ALL');
  const [filterCurrency, setFilterCurrency] = useState('ALL');
  const [filterDepartment, setFilterDepartment] = useState('ALL');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  
  const canEdit = hasPermission(user, 'CREATE_LOE');
  const canDelete = hasPermission(user, 'DELETE_LOE');
  const isAdmin = user.role === 'ADMIN';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchLoes();
    fetchDepartments();
    fetchServices();
    fetchCompanies();
  }, []);

  useEffect(() => {
    if (location.state?.editLoeId && loes.length > 0 && services.length > 0) {
      const target = loes.find(l => l.loe_id === location.state.editLoeId);
      if (target) {
        handleEdit(target);
      }
    }
  }, [location.state, loes, services]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const parseScopes = (scopeData) => {
    if (!scopeData) return [];
    if (Array.isArray(scopeData)) return scopeData;
    try {
      const parsed = JSON.parse(scopeData);
      if (Array.isArray(parsed)) return parsed;
      return [parsed.toString()];
    } catch {
      return scopeData.split('\n').map((s) => s.trim()).filter(Boolean);
    }
  };

  const fetchLoes = async () => {
    try {
      if (!token) {
        setActionError("Authentication token missing.");
        return;
      }
      
      const url = isAdmin 
        ? `${API_BASE}/api/loes?role=ADMIN`
        : `${API_BASE}/api/loes?department_id=${userDeptId}&role=${user.role || 'EMPLOYEE'}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch LOEs');
      }

      setLoes(Array.isArray(data) ? data : data.loes || []);
    } catch (err) {
      console.error(err);
      setActionError(err.message || 'Failed to load LOEs from server.');
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/departments`);
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.error('Failed to load departments', err);
    }
  };

  const fetchServices = async () => {
    try {
      if (!token) return;
      const response = await fetch(`${API_BASE}/api/services`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setServices(data);
    } catch (err) {
      console.error('Failed to load services', err);
    }
  };

  const fetchCompanies = async () => {
    try {
      if (!token) return;
      const response = await fetch(`${API_BASE}/api/companies`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setCompanies(Array.isArray(data) ? data : data.companies || []);
      }
    } catch (err) {
      console.error('Failed to load companies', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'type') {
      if (value === 'Adhoc') {
        setFormData(prev => ({
          ...prev,
          type: value,
          billing_frequency: 'One-Time'
        }));
      } else if (value === 'Retainer') {
        setFormData(prev => ({
          ...prev,
          type: value,
          billing_frequency: prev.billing_frequency === 'One-Time' ? 'Monthly' : prev.billing_frequency
        }));
      } else {
        setFormData(prev => ({ ...prev, [name]: value }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const openCreateModal = () => {
    setEditingId(null);
    setEditingPreviousStatus(null);
    setFormData({
      company_id: '',
      type: 'Adhoc',
      billing_frequency: 'One-Time',
      currency: 'LKR',
      start_date: '',
      loe_services: []
    });
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditingPreviousStatus(null);
    setFormData({
      company_id: '',
      type: 'Adhoc',
      billing_frequency: 'One-Time',
      currency: 'LKR',
      start_date: '',
      loe_services: []
    });
    setFormError('');
  };

  const addServiceCard = () => {
    setFormData(prev => ({
      ...prev,
      loe_services: [
        ...prev.loe_services, 
        { 
          department_id: '', 
          service_id: '', 
          custom_service_name: '',
          is_custom: false,
          amount: '',
          status: 'Pending',
          rejection_reason: null,
          selectedScopeChoice: '', 
          scopes: [] 
        }
      ]
    }));
  };

  const removeServiceCard = (serviceIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated.splice(serviceIndex, 1);
      return { ...prev, loe_services: updated };
    });
  };

  const handleDepartmentChange = (serviceIndex, deptId) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        department_id: deptId,
        service_id: '',
        amount: '',
        selectedScopeChoice: '',
        scopes: []
      };
      return { ...prev, loe_services: updated };
    });
  };


  const handleSwitchToCustom = (serviceIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const current = updated[serviceIndex];
      updated[serviceIndex] = {
        ...current,
        is_custom: true,
        service_id: 'CUSTOM',
        custom_service_name: current.custom_service_name || '',
        scopes: current.scopes.length > 0 ? current.scopes : ['']
      };
      return { ...prev, loe_services: updated };
    });
  };

  const handleSwitchToStandard = (serviceIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const current = updated[serviceIndex];
      updated[serviceIndex] = {
        ...current,
        is_custom: false,
        service_id: '',
        custom_service_name: '',
        scopes: []
      };
      return { ...prev, loe_services: updated };
    });
  };

  const handleCustomNameChange = (serviceIndex, name) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        custom_service_name: name
      };
      return { ...prev, loe_services: updated };
    });
  };

  const handleServiceChange = (serviceIndex, serviceId) => {
    if (serviceId === '__CUSTOM__' || serviceId === 'CUSTOM') {
      handleSwitchToCustom(serviceIndex);
      return;
    }
    const selectedSrv = services.find(s => s.service_id === Number(serviceId));
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        service_id: serviceId,
        is_custom: false,
        custom_service_name: '',
        amount: selectedSrv?.price ? Number(selectedSrv.price) : 0,
        selectedScopeChoice: '',
        scopes: []
      };
      return { ...prev, loe_services: updated };
    });
  };

  const handleAmountChange = (serviceIndex, amount) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...updated[serviceIndex],
        amount
      };
      return { ...prev, loe_services: updated };
    });
  };

  const addSelectedScope = (serviceIndex) => {
    const serviceBlock = formData.loe_services[serviceIndex];
    if (!serviceBlock.selectedScopeChoice) return;

    setFormData(prev => {
      const updated = [...prev.loe_services];
      updated[serviceIndex] = {
        ...serviceBlock,
        scopes: [...serviceBlock.scopes, serviceBlock.selectedScopeChoice],
        selectedScopeChoice: ''
      };
      return { ...prev, loe_services: updated };
    });
  };

  const addCustomScope = (serviceIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const serviceBlock = updated[serviceIndex];
      updated[serviceIndex] = {
        ...serviceBlock,
        scopes: [...serviceBlock.scopes, '']
      };
      return { ...prev, loe_services: updated };
    });
  };

  const handleScopeTextChange = (serviceIndex, scopeIndex, text) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const serviceBlock = updated[serviceIndex];
      const updatedScopes = [...serviceBlock.scopes];
      updatedScopes[scopeIndex] = text;
      updated[serviceIndex] = { ...serviceBlock, scopes: updatedScopes };
      return { ...prev, loe_services: updated };
    });
  };

  const removeScopeItem = (serviceIndex, scopeIndex) => {
    setFormData(prev => {
      const updated = [...prev.loe_services];
      const serviceBlock = updated[serviceIndex];
      const updatedScopes = [...serviceBlock.scopes];
      updatedScopes.splice(scopeIndex, 1);
      updated[serviceIndex] = { ...serviceBlock, scopes: updatedScopes };
      return { ...prev, loe_services: updated };
    });
  };

  const handleEdit = (loe) => {
    setEditingId(loe.loe_id);
    setEditingPreviousStatus(loe.status);

    const grouped = [];
    const map = new Map();

    (loe.loe_items || []).forEach(item => {
      const sId = item.service_id;
      if (!map.has(sId)) {
        const matched = services.find(s => s.service_id === sId);
        const newBlock = {
          department_id: matched ? matched.department_id : (item.service?.department_id || ''),
          service_id: sId,
          custom_service_name: matched ? matched.name : (item.service?.name || ''),
          is_custom: !matched && Boolean(item.service?.name),
          amount: item.amount !== undefined && item.amount !== null ? Number(item.amount) : (matched?.price || 0),
          status: item.status,
          rejection_reason: item.rejection_reason,
          selectedScopeChoice: '',
          scopes: []
        };
        map.set(sId, newBlock);
        grouped.push(newBlock);
      }
      if (item.custom_scope) {
        map.get(sId).scopes.push(item.custom_scope);
      }
    });

    setFormData({
      company_id: loe.company_id,
      type: loe.type === 'Retainer' ? 'Retainer' : 'Adhoc',
      billing_frequency: loe.billing_frequency || (loe.type === 'Retainer' ? 'Monthly' : 'One-Time'),
      currency: loe.currency || 'LKR',
      start_date: loe.start_date ? loe.start_date.split('T')[0] : '',
      loe_services: grouped
    });

    setFormError('');
    setIsModalOpen(true);
  };

  const handleDeleteLoe = async (e, loeId) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete LOE #${loeId}?`)) return;

    try {
      setActionError('');
      const response = await fetch(`${API_BASE}/api/loes/${loeId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to delete LOE');
      }

      setLoes(prev => prev.filter(l => l.loe_id !== loeId));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setActionError('');

    const url = editingId 
      ? `${API_BASE}/api/loes/${editingId}`
      : `${API_BASE}/api/loes`;
      
    const method = editingId ? 'PUT' : 'POST';

    const flattenedItems = [];
    formData.loe_services.forEach(srvBlock => {
      if (!srvBlock.service_id && !srvBlock.is_custom) return;
      if (srvBlock.is_custom && !srvBlock.custom_service_name?.trim()) return;

      const validScopes = srvBlock.scopes.filter(s => s.trim().length > 0);
      const isApproved = srvBlock.status === 'Approved';
      const itemAmount = Number(srvBlock.amount || 0);

      const baseItem = {
        amount: itemAmount,
        status: isApproved ? 'Approved' : 'Pending',
        is_custom: Boolean(srvBlock.is_custom),
        custom_service_name: srvBlock.is_custom ? srvBlock.custom_service_name.trim() : undefined,
        department_id: srvBlock.department_id ? Number(srvBlock.department_id) : undefined,
        service_id: srvBlock.is_custom ? 'CUSTOM' : Number(srvBlock.service_id)
      };

      if (validScopes.length === 0) {
        flattenedItems.push({
          ...baseItem,
          custom_scope: srvBlock.is_custom ? `${srvBlock.custom_service_name.trim()} - Scope as agreed` : 'Standard Service Scope'
        });
      } else {
        validScopes.forEach(sc => {
          flattenedItems.push({
            ...baseItem,
            custom_scope: sc
          });
        });
      }
    });

    if (flattenedItems.length === 0) {
      setFormError('Please add at least one service with scope deliverables.');
      return;
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          company_id: Number(formData.company_id),
          created_by: user.emp_id || 2, 
          type: formData.type,
          billing_frequency: formData.billing_frequency,
          currency: formData.currency,
          start_date: formData.start_date,
          loe_items: flattenedItems
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save LOE');

      await fetchLoes();
      closeModal();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDownloadPdf = async (e, loeId) => {
    e.stopPropagation(); 
    try {
      setDownloadingId(loeId);
      setActionError('');

      let response;
      const cacheBuster = `?t=${Date.now()}`;

      if (window.location.hostname === 'localhost') {
        try {
          response = await fetch(`http://localhost:3000/api/loes/${loeId}/pdf${cacheBuster}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch {
          response = null;
        }
      }

      if (!response || !response.ok) {
        response = await fetch(`${API_BASE}/api/loes/${loeId}/pdf${cacheBuster}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate PDF document');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `LOE-${loeId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setActionError(err.message || 'Error generating PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getCompanyName = (companyId) => {
    const found = companies.find(c => c.company_id === companyId);
    return found ? (found.name || found.company_name) : `Company ID: ${companyId}`;
  };

  const getStatusBadgeStyle = (status) => {
    if (status === 'Approved') return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
    if (status === 'Rejected') return { background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' };
    if (status === 'Discontinued') return { background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1' };
    if (status === 'Approval Pending') return { background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' };
    return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  };

  const resetFilters = () => {
    setFilterCompany('');
    setFilterStatus('ALL');
    setFilterType('ALL');
    setFilterFrequency('ALL');
    setFilterCurrency('ALL');
    setFilterDepartment('ALL');
  };

  const displayedLoes = loes.filter(loe => {
    if (!isAdmin) {
      const hasDept = (loe.loe_items || []).some(item => item.service?.department_id === userDeptId);
      if (!hasDept) return false;
    }

    if (filterCompany) {
      const compName = (getCompanyName(loe.company_id) || '').toLowerCase();
      if (!compName.includes(filterCompany.toLowerCase())) return false;
    }

    if (filterStatus !== 'ALL') {
      if (filterStatus === 'Approval Pending') {
        if (loe.status !== 'Approval Pending' && loe.status !== 'Pending') return false;
      } else if (loe.status !== filterStatus) {
        return false;
      }
    }

    if (filterType !== 'ALL') {
      const loeType = loe.type || 'Adhoc';
      if (loeType !== filterType) return false;
    }

    if (filterFrequency !== 'ALL') {
      const loeFreq = loe.billing_frequency || 'One-Time';
      if (loeFreq !== filterFrequency) return false;
    }

    if (filterCurrency !== 'ALL') {
      const loeCur = loe.currency || 'LKR';
      if (loeCur !== filterCurrency) return false;
    }

    if (isAdmin && filterDepartment !== 'ALL') {
      const hasSelectedDept = (loe.loe_items || []).some(
        item => Number(item.service?.department_id) === Number(filterDepartment)
      );
      if (!hasSelectedDept) return false;
    }

    return true;
  });

  const hasActiveFilters = 
    filterCompany !== '' ||
    filterStatus !== 'ALL' ||
    filterType !== 'ALL' ||
    filterFrequency !== 'ALL' ||
    filterCurrency !== 'ALL' ||
    (isAdmin && filterDepartment !== 'ALL');

  const activeSymbol = CURRENCY_SYMBOLS[formData.currency] || 'Rs.';

  if (!hasPermission(user, 'VIEW_LOES')) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view LOEs.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.contentWrapper}>
        
        {/* Top Header Row with Page Title, Stats, and Create Button */}
        <div style={styles.headerRow}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={styles.pageTitle}>Letters of Engagement [LOE]</h1>
              <span style={styles.countBadge}>
                {displayedLoes.length} {displayedLoes.length === 1 ? 'Record' : 'Records'}
              </span>
            </div>
            <p style={styles.pageSubtitle}>
              Manage engagement proposals, multi-department services, pricing, and approvals.
            </p>
          </div>

          {canEdit && (
            <button onClick={openCreateModal} style={styles.primaryActionBtn}>
              + Create LOE
            </button>
          )}
        </div>

        {/* Full-width Filter Bar */}
        <div style={styles.filterBar}>
          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Company</label>
            <input
              type="text"
              list="loe-company-filter-list"
              placeholder="Search company..."
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              style={styles.filterInput}
            />
            <datalist id="loe-company-filter-list">
              {companies.map((c) => (
                <option key={c.company_id} value={c.name || c.company_name} />
              ))}
            </datalist>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Statuses</option>
              <option value="Approval Pending">Approval Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Type</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Types</option>
              <option value="Adhoc">Adhoc</option>
              <option value="Retainer">Retainer</option>
            </select>
          </div>

          <div style={styles.filterField}>
            <label style={styles.filterLabel}>Billing Cycle</label>
            <select
              value={filterFrequency}
              onChange={(e) => setFilterFrequency(e.target.value)}
              style={styles.filterSelect}
            >
              <option value="ALL">All Cycles</option>
              <option value="One-Time">One-Time</option>
              <option value="Monthly">Monthly</option>
              <option value="Quarterly">Quarterly</option>
              <option value="Annually">Annually</option>
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

          {isAdmin && (
            <div style={styles.filterField}>
              <label style={styles.filterLabel}>Department (Admin)</label>
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
          )}

          {hasActiveFilters && (
            <button type="button" onClick={resetFilters} style={styles.clearFilterBtn}>
              Reset Filters
            </button>
          )}
        </div>

        {actionError && (
          <div style={styles.actionErrorBox}>
            {actionError}
          </div>
        )}

        {/* Existing LOEs Grid */}
        <div style={styles.listSection}>
          {displayedLoes.length === 0 ? (
            <div style={styles.emptyCard}>No LOEs found matching your criteria.</div>
          ) : (
            <div style={styles.grid}>
              {displayedLoes.map((loe) => {
                const badgeStyle = getStatusBadgeStyle(loe.status);
                const loeCurrency = loe.currency || 'LKR';
                const loeSymbol = CURRENCY_SYMBOLS[loeCurrency] || (loeCurrency + ' ');

                const relevantItems = isAdmin 
                  ? (loe.loe_items || [])
                  : (loe.loe_items || []).filter(item => item.service?.department_id === userDeptId);

                const totalFee = (loe.loe_items || []).reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

                return (
                  <div 
                    key={loe.loe_id} 
                    onClick={() => navigate(`/loes/${loe.loe_id}`)}
                    style={styles.card}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>
                        {loe.loe_code || `LOE #${loe.loe_id}`}
                      </h3>
                      <span style={{ ...styles.badge, ...badgeStyle }}>{loe.status}</span>
                    </div>

                    <p style={{ marginTop: '8px', marginBottom: '2px', fontSize: '13.5px', color: '#1e293b' }}>
                      <strong>Company:</strong> {getCompanyName(loe.company_id)}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', margin: '6px 0' }}>
                      <span style={{ color: '#0284c7', fontWeight: 'bold' }}>
                        Billing: {loe.billing_frequency || 'One-Time'}
                      </span>
                      <span style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', fontSize: '11px' }}>
                        {loeCurrency}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 10px', fontSize: '13.5px', color: '#0f172a', fontWeight: 'bold' }}>
                      Total Engagement: <span style={{ color: '#0284c7' }}>{loeSymbol} {totalFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </p>

                    <div style={styles.cardItemsList}>
                      <span style={{ fontSize: '11.5px', fontWeight: 'bold', color: '#64748b' }}>
                        Services &amp; Pricing ({relevantItems.length}):
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                        {relevantItems.slice(0, 3).map((item) => (
                          <div key={item.loe_item_id} style={styles.miniItemRow}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px', color: '#334155' }}>
                              {item.service?.name}
                            </span>
                            <span style={{ fontWeight: 'bold', color: '#0f172a', fontSize: '11.5px' }}>
                              {loeSymbol} {Number(item.amount || 0).toFixed(2)}
                            </span>
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 'bold',
                              color: item.status === 'Approved' ? '#059669' : item.status === 'Rejected' ? '#e11d48' : '#d97706'
                            }}>
                              {item.status || 'Pending'}
                            </span>
                          </div>
                        ))}
                        {relevantItems.length > 3 && (
                          <span style={{ fontSize: '11.5px', color: '#0284c7', fontWeight: 'bold' }}>
                            + {(relevantItems.length - 3)} more (click to view all)
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={styles.cardActions}>
                      {canEdit && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(loe);
                          }} 
                          style={styles.editButton}
                        >
                          {loe.status === 'Rejected' ? 'Edit & Resubmit' : 'Edit'}
                        </button>
                      )}

                      <button 
                        onClick={(e) => handleDownloadPdf(e, loe.loe_id)} 
                        disabled={downloadingId === loe.loe_id}
                        style={styles.downloadButton}
                      >
                        {downloadingId === loe.loe_id ? 'PDF...' : 'PDF'}
                      </button>

                      {canDelete && (
                        <button
                          onClick={(e) => handleDeleteLoe(e, loe.loe_id)}
                          style={styles.deleteButton}
                        >
                          Delete
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

      {/* LOE Builder / Editor Modal Dialog */}
      {isModalOpen && canEdit && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.builderModalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? `Edit LOE #${editingId}` : 'Create New Letter of Engagement'}
                </h2>
                <p style={styles.modalSubtitle}>
                  Configure client entity, engagement type, billing cycle, deliverables, and service scopes.
                </p>
              </div>
              <button onClick={closeModal} style={styles.closeBtn} title="Close dialog">
                ✕
              </button>
            </div>

            {editingId && editingPreviousStatus === 'Rejected' && (
              <div style={styles.resubmitNotice}>
                This LOE contains rejected services. Only the rejected services will reset to <strong>Pending</strong> upon resubmission. Previously approved services will stay <strong>Approved</strong>.
              </div>
            )}

            {formError && <div style={styles.errorBox}>{formError}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Select Client Company *</label>
                <select 
                  name="company_id" 
                  value={formData.company_id} 
                  onChange={handleChange} 
                  required 
                  style={styles.input}
                >
                  <option value="" disabled>Select Company</option>
                  {companies.map((comp) => (
                    <option key={comp.company_id} value={comp.company_id}>
                      {comp.name || comp.company_name || `Company #${comp.company_id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '140px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={styles.label}>Engagement Type *</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    required
                    style={styles.input}
                    title="Engagement Type"
                  >
                    <option value="Adhoc">Adhoc</option>
                    <option value="Retainer">Retainer</option>
                  </select>
                </div>

                <div style={{ flex: 1.2, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={styles.label}>Billing Frequency *</label>
                  <select
                    name="billing_frequency"
                    value={formData.billing_frequency}
                    onChange={handleChange}
                    required
                    style={styles.input}
                    title="Billing Frequency"
                  >
                    {formData.type === 'Adhoc' ? (
                      <option value="One-Time">One-Time Billing (Standard)</option>
                    ) : (
                      <>
                        <option value="Monthly">Monthly Recurring Retainer</option>
                        <option value="Quarterly">Quarterly Recurring</option>
                        <option value="Annually">Annually Recurring</option>
                      </>
                    )}
                  </select>
                </div>

                <div style={{ flex: 1, minWidth: '130px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={styles.label}>Currency *</label>
                  <select
                    name="currency"
                    value={formData.currency}
                    onChange={handleChange}
                    required
                    style={{ ...styles.input, fontWeight: 'bold' }}
                    title="Payment Currency for Client"
                  >
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

                <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={styles.label}>Engagement Start Date *</label>
                  <input 
                    type="date" 
                    name="start_date" 
                    value={formData.start_date} 
                    onChange={handleChange} 
                    required 
                    style={styles.input} 
                  />
                </div>
              </div>

              {/* Multi-service Builder */}
              <div style={styles.itemsWrapper}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '15px', margin: 0, color: '#0f172a', fontWeight: '700' }}>
                    Services, Pricing &amp; Scope Requirements
                  </h3>
                  <span style={{ fontSize: '12.5px', fontWeight: 'bold', color: '#0284c7' }}>
                    Billing in: {formData.currency} ({activeSymbol})
                  </span>
                </div>
                
                {formData.loe_services.map((srvBlock, srvIdx) => {
                  const departmentServices = services.filter(
                    srv => srv.department_id === Number(srvBlock.department_id)
                  );
                  const selectedService = services.find(
                    srv => srv.service_id === Number(srvBlock.service_id)
                  );
                  const templateScopes = selectedService ? parseScopes(selectedService.scope) : [];

                  const isApproved = srvBlock.status === 'Approved';
                  const isRejected = srvBlock.status === 'Rejected';

                  return (
                    <div 
                      key={srvIdx} 
                      style={{
                        ...styles.serviceCard,
                        border: isRejected ? '1.5px solid #e11d48' : isApproved ? '1.5px solid #059669' : '1px solid #e2e8f0'
                      }}
                    >
                      {isApproved && (
                        <div style={styles.approvedBanner}>
                          Approved by department manager (Will remain approved)
                        </div>
                      )}
                      {isRejected && (
                        <div style={styles.rejectedItemNotice}>
                          <strong>Rejected by Manager:</strong> {srvBlock.rejection_reason || 'Revision required'}
                          <div style={{ fontSize: '11px', marginTop: '2px' }}>
                            Adjust scopes below. On resubmit, only this service will be sent for re-approval.
                          </div>
                        </div>
                      )}

                      <div style={styles.topSelectRow}>
                        <select 
                          value={srvBlock.department_id || ''} 
                          onChange={(e) => handleDepartmentChange(srvIdx, e.target.value)}
                          style={styles.dropdownInput} 
                          required
                        >
                          <option value="" disabled>Select Department</option>
                          {departments.map(dept => (
                            <option key={dept.department_id} value={dept.department_id}>
                              {dept.name}
                            </option>
                          ))}
                        </select>

                        {srvBlock.is_custom ? (
                          <div style={{ display: 'flex', flex: 1, gap: '8px', alignItems: 'center' }}>
                            <input
                              type="text"
                              placeholder="Type Custom Service Name (e.g. Specialized Advisory)"
                              value={srvBlock.custom_service_name || ''}
                              onChange={(e) => handleCustomNameChange(srvIdx, e.target.value)}
                              required
                              style={{ ...styles.dropdownInput, borderColor: '#0284c7', background: '#f0f9ff' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSwitchToStandard(srvIdx)}
                              style={styles.switchModeBtn}
                              title="Switch back to predefined standard services"
                            >
                              Standard ↻
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flex: 1, gap: '6px', alignItems: 'center' }}>
                            <select 
                              value={srvBlock.service_id || ''} 
                              onChange={(e) => handleServiceChange(srvIdx, e.target.value)}
                              style={{ ...styles.dropdownInput, flex: 1 }} 
                              disabled={!srvBlock.department_id}
                              required
                            >
                              <option value="" disabled>
                                {!srvBlock.department_id 
                                  ? 'Select Dept First' 
                                  : departmentServices.length === 0 
                                    ? 'No standard services found' 
                                    : 'Select Service'}
                              </option>
                              {departmentServices.map(srv => (
                                <option key={srv.service_id} value={srv.service_id}>
                                  {srv.name} (Base: {activeSymbol}{Number(srv.price || 0).toFixed(2)})
                                </option>
                              ))}
                              <option value="__CUSTOM__" style={{ fontWeight: 'bold', color: '#0284c7' }}>
                                ✨ + Create Custom Service (Client Specific)
                              </option>
                            </select>
                            {srvBlock.department_id && (
                              <button
                                type="button"
                                onClick={() => handleSwitchToCustom(srvIdx)}
                                style={styles.customPillBtn}
                                title="Type a custom service name for this client"
                              >
                                + Custom
                              </button>
                            )}
                          </div>
                        )}

                        <div style={styles.priceInputWrapper}>
                          <span style={styles.currencyPrefix}>{activeSymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Price"
                            value={srvBlock.amount !== undefined ? srvBlock.amount : ''}
                            onChange={(e) => handleAmountChange(srvIdx, e.target.value)}
                            required
                            style={styles.servicePriceInput}
                            title={`Price in ${formData.currency}`}
                          />
                        </div>

                        <button 
                          type="button" 
                          onClick={() => removeServiceCard(srvIdx)} 
                          style={styles.removeServiceBtn}
                          title="Remove Service"
                        >
                          ✕
                        </button>
                      </div>

                      {(selectedService || srvBlock.is_custom) && (
                        <div style={styles.scopeSelectionSection}>
                          {srvBlock.is_custom ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#0369a1' }}>
                                 Custom Scope Deliverables for Client:
                              </span>
                              <button
                                type="button"
                                onClick={() => addCustomScope(srvIdx)}
                                style={styles.addCustomBtn}
                              >
                                + Add Custom Scope
                              </button>
                            </div>
                          ) : (
                            <div style={styles.scopeToolbar}>
                              <select
                                value={srvBlock.selectedScopeChoice || ''}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setFormData(prev => {
                                    const updated = [...prev.loe_services];
                                    updated[srvIdx].selectedScopeChoice = val;
                                    return { ...prev, loe_services: updated };
                                  });
                                }}
                                style={styles.dropdownInput}
                              >
                                <option value="" disabled>Select Scope Template...</option>
                                {templateScopes.map((sc, i) => (
                                  <option key={i} value={sc}>
                                    {sc}
                                  </option>
                                ))}
                              </select>

                              <button
                                type="button"
                                onClick={() => addSelectedScope(srvIdx)}
                                disabled={!srvBlock.selectedScopeChoice}
                                style={styles.addScopeBtn}
                              >
                                + Add Selected Scope
                              </button>

                              <button
                                type="button"
                                onClick={() => addCustomScope(srvIdx)}
                                style={styles.addCustomBtn}
                              >
                                + Custom Scope
                              </button>
                            </div>
                          )}

                          <div style={styles.scopeListContainer}>
                            {srvBlock.scopes.length === 0 ? (
                              <p style={styles.emptyNotice}>
                                {srvBlock.is_custom
                                  ? 'No custom scopes added yet. Click "+ Add Custom Scope" to type client deliverables.'
                                  : 'No scopes added yet. Select a scope from the dropdown above or click "+ Custom Scope".'}
                              </p>
                            ) : (
                              srvBlock.scopes.map((scopeText, scIdx) => (
                                <div key={scIdx} style={styles.scopeItemRow}>
                                  <span style={styles.scopeIndexBadge}>{scIdx + 1}</span>
                                  <textarea
                                    rows="2"
                                    placeholder={srvBlock.is_custom ? "Type client-specific scope deliverable..." : "Enter or customize scope details for this engagement..."}
                                    value={scopeText}
                                    onChange={(e) => handleScopeTextChange(srvIdx, scIdx, e.target.value)}
                                    style={styles.scopeTextarea}
                                    required
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeScopeItem(srvIdx, scIdx)}
                                    style={styles.removeScopeBtn}
                                    title="Delete scope"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button type="button" onClick={addServiceCard} style={styles.addCardBtn}>
                  + Add Service
                </button>
              </div>

              <div style={styles.buttonGroup}>
                <button type="submit" style={styles.button}>
                  {editingId ? 'Resubmit for Approval' : 'Submit for Approval'}
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
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  pageTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#0f172a'
  },
  pageSubtitle: {
    margin: '4px 0 0 0',
    color: '#64748b',
    fontSize: '14px'
  },
  countBadge: {
    background: '#e0f2fe',
    color: '#0369a1',
    border: '1px solid #bae6fd',
    padding: '3px 10px',
    borderRadius: '14px',
    fontSize: '12px',
    fontWeight: 'bold'
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
    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
    transition: 'background 0.15s ease'
  },
  filterBar: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    alignItems: 'flex-end',
    background: '#ffffff',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    marginBottom: '22px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)'
  },
  filterField: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: '1',
    minWidth: '130px'
  },
  filterLabel: {
    fontSize: '11.5px',
    fontWeight: 'bold',
    color: '#475569'
  },
  filterInput: {
    padding: '8px 10px',
    borderRadius: '5px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    background: '#ffffff',
    color: '#0f172a'
  },
  filterSelect: {
    padding: '8px 10px',
    borderRadius: '5px',
    border: '1px solid #cbd5e1',
    fontSize: '12.5px',
    background: '#ffffff',
    color: '#0f172a'
  },
  clearFilterBtn: {
    padding: '8px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '5px',
    fontWeight: 'bold',
    fontSize: '12px',
    cursor: 'pointer',
    height: '35px'
  },
  actionErrorBox: {
    background: '#fff1f2',
    color: '#e11d48',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '18px',
    border: '1px solid #fecdd3',
    fontSize: '13.5px'
  },
  listSection: {
    width: '100%'
  },
  emptyCard: {
    background: '#ffffff',
    padding: '40px',
    textAlign: 'center',
    borderRadius: '8px',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    fontSize: '14px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
    gap: '20px'
  },
  card: {
    background: '#fff',
    padding: '18px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
    border: '1px solid #e2e8f0'
  },
  badge: {
    padding: '3px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  cardItemsList: {
    margin: '10px 0',
    padding: '10px',
    background: '#f8fafc',
    borderRadius: '6px',
    border: '1px solid #f1f5f9'
  },
  miniItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '12px'
  },
  cardActions: {
    display: 'flex',
    gap: '6px',
    marginTop: '14px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  editButton: {
    flex: '1',
    padding: '7px 10px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  downloadButton: {
    flex: '1',
    padding: '7px 10px',
    background: '#0891b2',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  deleteButton: {
    flex: '0.8',
    padding: '7px 10px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },

  // Builder Modal Dialog Styles
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
  builderModalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '880px',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
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
    borderRadius: '5px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    background: '#ffffff',
    color: '#0f172a'
  },
  itemsWrapper: {
    padding: '18px',
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px'
  },
  serviceCard: {
    background: '#fff',
    borderRadius: '6px',
    padding: '14px',
    marginBottom: '14px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
  },
  topSelectRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap'
  },
  dropdownInput: {
    flex: '1',
    minWidth: '160px',
    padding: '9px 10px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    background: '#ffffff'
  },
  priceInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '0 8px',
    minWidth: '120px'
  },
  currencyPrefix: {
    fontSize: '13px',
    color: '#475569',
    fontWeight: 'bold',
    marginRight: '4px'
  },
  servicePriceInput: {
    border: 'none',
    outline: 'none',
    padding: '9px 4px',
    width: '100%',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#0f172a'
  },
  customPillBtn: { padding: '8px 12px', background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' },
  switchModeBtn: { padding: '8px 12px', background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', fontSize: '11.5px', cursor: 'pointer', whiteSpace: 'nowrap' },
  removeServiceBtn: {
    padding: '9px 12px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  scopeSelectionSection: {
    marginTop: '12px',
    borderTop: '1px dashed #e2e8f0',
    paddingTop: '12px'
  },
  scopeToolbar: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap'
  },
  addScopeBtn: {
    padding: '8px 12px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  addCustomBtn: {
    padding: '8px 12px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  scopeListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  scopeItemRow: {
    display: 'flex',
    gap: '8px',
    alignItems: 'flex-start',
    background: '#f8fafc',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #e2e8f0'
  },
  scopeIndexBadge: {
    background: '#e2e8f0',
    color: '#334155',
    fontWeight: 'bold',
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '3px',
    marginTop: '4px'
  },
  scopeTextarea: {
    flex: '1',
    padding: '8px',
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontFamily: 'inherit',
    fontSize: '13px',
    resize: 'vertical',
    color: '#0f172a'
  },
  removeScopeBtn: {
    padding: '6px 10px',
    background: '#fff1f2',
    color: '#e11d48',
    border: '1px solid #fecdd3',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    marginTop: '4px'
  },
  emptyNotice: {
    margin: 0,
    fontSize: '12.5px',
    color: '#64748b',
    fontStyle: 'italic',
    padding: '6px'
  },
  addCardBtn: {
    width: '100%',
    padding: '11px',
    background: '#f8fafc',
    color: '#0284c7',
    border: '1px dashed #bae6fd',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '10px',
    paddingTop: '14px',
    borderTop: '1px solid #f1f5f9'
  },
  button: {
    flex: '1',
    padding: '11px',
    background: '#0284c7',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  cancelButton: {
    flex: '1',
    padding: '11px',
    background: '#f1f5f9',
    color: '#475569',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  resubmitNotice: {
    padding: '12px 14px',
    background: '#fffbeb',
    border: '1px solid #fde68a',
    color: '#d97706',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '14px'
  },
  approvedBanner: {
    padding: '6px 10px',
    background: '#ecfdf5',
    color: '#059669',
    borderRadius: '4px',
    fontSize: '12px',
    marginBottom: '10px',
    border: '1px solid #a7f3d0',
    fontWeight: 'bold'
  },
  rejectedItemNotice: {
    padding: '8px 12px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '4px',
    fontSize: '12px',
    marginBottom: '10px',
    border: '1px solid #fecdd3'
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
  }
};

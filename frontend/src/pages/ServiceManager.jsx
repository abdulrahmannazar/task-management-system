import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import { usePermissions } from '../utils/permissionHelper';

// Helper to parse multi-line or bulleted scopes into clean structured points
const parseScopePoints = (scopeText) => {
  if (!scopeText) return [];
  return String(scopeText)
    .split(/\r?\n|(?=[•●▪♦\u2022])|\b(?=\d+\.\s+)/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (/^[oO]\s+/.test(line)) {
        return {
          type: 'sub',
          text: line.replace(/^[oO]\s+/, '').trim()
        };
      }
      const cleaned = line.replace(/^[-*•●▪♦\d.\s]+/, '').trim();
      return {
        type: 'main',
        text: cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
      };
    })
    .filter((item) => item.text.length > 0);
};

export default function ServiceManager() {
  const { hasPermission } = usePermissions();

  const [services, setServices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [selectedService, setSelectedService] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  const isAdmin = user?.role === 'ADMIN';
  const userDeptId = user?.department_id || 1;

  const canViewServices = hasPermission(user, 'VIEW_SERVICES');
  const canManageServices = hasPermission(user, 'MANAGE_SERVICES');

  const initialFormState = {
    department_id: isAdmin ? '' : userDeptId,
    name: '',
    sub_category: '',
    billing_type: 'Fixed',
    price: '',
    scope: '',
    is_active: true
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    fetchServices();
    fetchDepartments();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (isModalOpen) closeModal();
        if (selectedService) setSelectedService(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, selectedService]);

  const fetchServices = async () => {
    try {
      const url = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/services?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/services?department_id=${userDeptId}&role=MANAGER`;

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) setServices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/departments');
      const data = await response.json();
      if (response.ok && Array.isArray(data)) setDepartments(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  const openCreateModal = () => {
    setEditingId(null);
    setSelectedService(null);
    setFormData({
      department_id: isAdmin ? '' : userDeptId,
      name: '',
      sub_category: '',
      billing_type: 'Fixed',
      price: '',
      scope: '',
      is_active: true
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({
      department_id: isAdmin ? '' : userDeptId,
      name: '',
      sub_category: '',
      billing_type: 'Fixed',
      price: '',
      scope: '',
      is_active: true
    });
    setError('');
  };

  const handleEdit = (e, srv) => {
    if (e) e.stopPropagation();
    setSelectedService(null);
    setEditingId(srv.service_id);
    setFormData({
      department_id: srv.department_id,
      name: srv.name,
      sub_category: srv.sub_category || '',
      billing_type: srv.billing_type || 'Fixed',
      price: srv.price !== undefined && srv.price !== null ? srv.price : '',
      scope: srv.scope || '',
      is_active: srv.is_active
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    const url = editingId
      ? `https://task-management-system-6ifq.onrender.com/api/services/${editingId}`
      : 'https://task-management-system-6ifq.onrender.com/api/services';

    const method = editingId ? 'PUT' : 'POST';

    const payload = {
      ...formData,
      department_id: isAdmin ? Number(formData.department_id) : userDeptId,
      price: formData.price !== '' ? Number(formData.price) : 0
    };

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to save service');

      await fetchServices();
      closeModal();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find((d) => d.department_id === Number(deptId));
    return found ? found.name : `Dept #${deptId}`;
  };

  const displayedServices = services.filter((srv) => {
    if (!isAdmin || selectedDeptFilter === 'ALL') return true;
    return srv.department_id === Number(selectedDeptFilter);
  });

  if (!canViewServices) {
    return (
      <div style={styles.pageContainer}>
        <Navbar />
        <div style={{ padding: '40px', textAlign: 'center' }}>
          Access Denied. You do not have permission to view the Services page.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.contentWrapper}>
        
        {/* Top Header Row with Title, Filter, and Action Button */}
        <div style={styles.headerRow}>
          <div>
            <h1 style={styles.pageTitle}>
              {isAdmin ? 'All Standard Services' : `${getDepartmentName(userDeptId)} Services`}
            </h1>
            <p style={styles.pageSubtitle}>
              {displayedServices.length} registered service{displayedServices.length === 1 ? '' : 's'}. Click any card to inspect deliverables and pricing.
            </p>
          </div>

          <div style={styles.headerActions}>
            {isAdmin && (
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                style={styles.filterDropdown}
              >
                <option value="ALL">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.department_id} value={dept.department_id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            )}

            {canManageServices && (
              <button onClick={openCreateModal} style={styles.primaryActionBtn}>
                + Add Service
              </button>
            )}
          </div>
        </div>

        {error && !isModalOpen && (
          <div style={styles.inlineErrorBox}>{error}</div>
        )}

        {/* Full-width Services Directory Grid */}
        <div style={styles.listSection}>
          {displayedServices.length === 0 ? (
            <div style={styles.emptyState}>No services registered in this department yet.</div>
          ) : (
            <div style={styles.grid}>
              {displayedServices.map((srv) => {
                const parsedPoints = parseScopePoints(srv.scope);
                const previewPoints = parsedPoints.slice(0, 3);
                const remainingCount = parsedPoints.length - previewPoints.length;

                return (
                  <div
                    key={srv.service_id}
                    onClick={() => setSelectedService(srv)}
                    style={styles.card}
                    title="Click to view full service details"
                  >
                    <div>
                      <div style={styles.cardTopRow}>
                        <div style={{ flex: 1, paddingRight: '10px' }}>
                          <h3 style={styles.cardTitle}>{srv.name}</h3>
                          <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={styles.categoryBadge}>{srv.sub_category || 'Standard'}</span>
                            <span style={styles.deptBadge}>
                              {srv.department?.name || getDepartmentName(srv.department_id)}
                            </span>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={styles.priceBadge}>
                            Rs. {Number(srv.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                            {srv.billing_type}
                          </div>
                        </div>
                      </div>

                      {parsedPoints.length > 0 && (
                        <div style={styles.scopePreviewBox}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>
                              Default Scope ({parsedPoints.length} {parsedPoints.length === 1 ? 'item' : 'items'}):
                            </span>
                          </div>
                          <ul style={styles.previewBulletList}>
                            {previewPoints.map((pt, i) => (
                              <li key={i} style={styles.previewBulletItem}>
                                {pt.text.length > 90 ? `${pt.text.slice(0, 90)}...` : pt.text}
                              </li>
                            ))}
                          </ul>
                          {remainingCount > 0 && (
                            <div style={styles.moreItemsHint}>
                              + {remainingCount} more deliverable{remainingCount === 1 ? '' : 's'} — Click to view in detail →
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={styles.cardFooter}>
                      <span style={{ fontSize: '12px', color: srv.is_active ? '#059669' : '#e11d48', fontWeight: 'bold' }}>
                        {srv.is_active ? '● Active' : '○ Inactive'}
                      </span>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={styles.viewDetailLink}>View Details</span>
                        {canManageServices && (
                          <button
                            type="button"
                            onClick={(e) => handleEdit(e, srv)}
                            style={styles.editBtn}
                          >
                            Edit Service &amp; Price
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Add / Edit Service Modal Dialog */}
      {isModalOpen && canManageServices && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <h2 style={styles.modalTitle}>
                  {editingId ? `Edit Service #${editingId}` : 'Add New Service'}
                </h2>
                <p style={styles.modalSubtitle}>
                  Set service categories, deliverables, default scope, and base pricing in LKR.
                </p>
              </div>
              <button onClick={closeModal} style={styles.closeBtn} title="Close dialog">
                ✕
              </button>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}

            <form onSubmit={handleSubmit} style={styles.form}>
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Department *</label>
                {isAdmin ? (
                  <select
                    name="department_id"
                    value={formData.department_id}
                    onChange={handleChange}
                    required
                    style={styles.input}
                  >
                    <option value="" disabled>-- Select Department --</option>
                    {departments.map((dept) => (
                      <option key={dept.department_id} value={dept.department_id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={styles.lockedField}>
                    <strong>{getDepartmentName(userDeptId)}</strong>
                    <span style={styles.lockedNote}>(Locked to your managing department)</span>
                  </div>
                )}
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Service Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Annual Audit & Financial Statements"
                  required
                  style={styles.input}
                />
              </div>

              <div style={styles.formRow}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={styles.label}>Sub-Category</label>
                  <input
                    type="text"
                    name="sub_category"
                    value={formData.sub_category}
                    onChange={handleChange}
                    placeholder="e.g. Assurance, Statutory"
                    style={styles.input}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={styles.label}>Billing Type *</label>
                  <select
                    name="billing_type"
                    value={formData.billing_type}
                    onChange={handleChange}
                    style={styles.input}
                  >
                    <option value="Fixed">Fixed Fee</option>
                    <option value="Hourly">Hourly Rate</option>
                    <option value="Monthly">Monthly Retainer</option>
                    <option value="Quarterly">Quarterly</option>
                  </select>
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Base Price / Standard Fee (LKR) *</label>
                <div style={styles.priceInputWrapper}>
                  <span style={styles.currencyPrefix}>Rs.</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    name="price"
                    value={formData.price}
                    onChange={handleChange}
                    placeholder="e.g. 500.00"
                    required
                    style={styles.priceInput}
                  />
                </div>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Default LKR price that auto-populates when added to an LOE.
                </span>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.label}>Default Scope Template (Separate lines with Enter)</label>
                <textarea
                  rows="4"
                  name="scope"
                  value={formData.scope}
                  onChange={handleChange}
                  placeholder="Review previous audit files&#10;Conduct year-end verification&#10;Draft audit report for management"
                  style={{ ...styles.input, fontFamily: 'inherit', resize: 'vertical' }}
                />
              </div>

              {editingId && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    name="is_active"
                    checked={formData.is_active}
                    onChange={handleChange}
                  />
                  Service is Active &amp; Selectable in LOEs
                </label>
              )}

              <div style={styles.buttonGroup}>
                <button type="submit" disabled={saving} style={styles.button}>
                  {saving ? 'Saving...' : editingId ? 'Update Service' : 'Create Service'}
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

      {/* Service Details View Modal */}
      {selectedService && (
        <div
          style={styles.modalOverlay}
          onClick={() => setSelectedService(null)}
        >
          <div
            style={styles.viewModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '21px', color: '#0f172a' }}>
                    {selectedService.name}
                  </h2>
                  <span
                    style={{
                      padding: '3px 10px',
                      borderRadius: '12px',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      background: selectedService.is_active ? '#ecfdf5' : '#fff1f2',
                      color: selectedService.is_active ? '#059669' : '#e11d48'
                    }}
                  >
                    {selectedService.is_active ? '● Active' : '○ Inactive'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Service ID: #{selectedService.service_id} &nbsp;&bull;&nbsp; Department:{' '}
                  <strong>
                    {selectedService.department?.name || getDepartmentName(selectedService.department_id)}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedService(null)}
                style={styles.closeBtn}
                title="Close"
              >
                ✕
              </button>
            </div>

            {/* Service Metadata Summary Cards */}
            <div style={styles.modalMetaGrid}>
              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Standard Base Fee (LKR)</span>
                <span style={{ ...styles.metaValue, color: '#0284c7', fontSize: '17px' }}>
                  Rs.{' '}
                  {Number(selectedService.price || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Billing Type</span>
                <span style={styles.metaValue}>{selectedService.billing_type || 'Fixed Fee'}</span>
              </div>

              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Sub-Category</span>
                <span style={styles.metaValue}>{selectedService.sub_category || 'Standard'}</span>
              </div>

              <div style={styles.metaCard}>
                <span style={styles.metaLabel}>Department</span>
                <span style={styles.metaValue}>
                  {selectedService.department?.name || getDepartmentName(selectedService.department_id)}
                </span>
              </div>
            </div>

            {/* Full Scope of Work & Deliverables */}
            <div style={styles.modalScopeContainer}>
              <h4 style={styles.modalScopeHeading}>
                Full Default Scope of Work &amp; Deliverables
              </h4>

              {parseScopePoints(selectedService.scope).length === 0 ? (
                <p style={{ margin: 0, color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                  No default scope template defined for this service.
                </p>
              ) : (
                <ul style={styles.modalScopeList}>
                  {parseScopePoints(selectedService.scope).map((pt, idx) => (
                    <li
                      key={idx}
                      style={
                        pt.type === 'sub'
                          ? styles.modalScopeSubItem
                          : styles.modalScopeMainItem
                      }
                    >
                      {pt.type === 'sub' ? `o  ${pt.text}` : pt.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div style={styles.modalActions}>
              <button
                type="button"
                onClick={() => setSelectedService(null)}
                style={styles.modalCloseActionBtn}
              >
                Close
              </button>

              {canManageServices && (
                <button
                  type="button"
                  onClick={(e) => handleEdit(e, selectedService)}
                  style={styles.modalEditActionBtn}
                >
                  Edit Service &amp; Price
                </button>
              )}
            </div>
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
    fontFamily: 'system-ui',
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
    marginBottom: '24px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
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
  filterDropdown: {
    padding: '9px 14px',
    borderRadius: '6px',
    border: '1px solid #cbd5e1',
    fontSize: '13px',
    background: '#ffffff',
    color: '#334155',
    fontWeight: 'bold'
  },
  listSection: {
    width: '100%'
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
  inlineErrorBox: {
    padding: '12px 16px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    fontSize: '13.5px',
    border: '1px solid #fecdd3',
    marginBottom: '20px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: '18px'
  },
  card: {
    background: '#fff',
    padding: '18px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    border: '1px solid #e2e8f0',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease'
  },
  cardTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px'
  },
  cardTitle: {
    margin: 0,
    fontSize: '16px',
    color: '#0f172a',
    lineHeight: '1.35',
    fontWeight: '700'
  },
  categoryBadge: { background: '#f1f5f9', color: '#475569', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' },
  deptBadge: { background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 7px', borderRadius: '4px', fontSize: '11px', fontWeight: '500' },
  priceBadge: {
    background: '#ecfdf5',
    color: '#059669',
    padding: '4px 9px',
    borderRadius: '5px',
    fontSize: '13px',
    fontWeight: 'bold',
    border: '1px solid #a7f3d0',
    whiteSpace: 'nowrap',
    display: 'inline-block'
  },
  scopePreviewBox: {
    marginTop: '12px',
    background: '#f8fafc',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #e2e8f0'
  },
  previewBulletList: {
    margin: '4px 0 0 0',
    paddingLeft: '16px',
    fontSize: '12px',
    color: '#475569',
    lineHeight: '1.5'
  },
  previewBulletItem: {
    marginBottom: '3px'
  },
  moreItemsHint: {
    marginTop: '6px',
    fontSize: '11.5px',
    fontWeight: 'bold',
    color: '#0284c7'
  },
  cardFooter: {
    marginTop: '14px',
    paddingTop: '10px',
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  viewDetailLink: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#64748b'
  },
  editBtn: {
    padding: '6px 12px',
    background: '#f0f9ff',
    color: '#0284c7',
    border: '1px solid #bae6fd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '12px'
  },

  // Modal Dialogs
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
    maxWidth: '620px',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '28px',
    boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
    border: '1px solid #e2e8f0'
  },
  viewModalContent: {
    background: '#ffffff',
    borderRadius: '10px',
    width: '100%',
    maxWidth: '720px',
    maxHeight: '88vh',
    overflowY: 'auto',
    padding: '26px 28px',
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
    gap: '14px'
  },
  formRow: {
    display: 'flex',
    gap: '12px'
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
    borderRadius: '4px',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    background: '#ffffff',
    color: '#0f172a'
  },
  priceInputWrapper: {
    display: 'flex',
    alignItems: 'center',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    background: '#fff',
    padding: '0 10px'
  },
  currencyPrefix: {
    fontSize: '13.5px',
    fontWeight: 'bold',
    color: '#334155',
    marginRight: '6px'
  },
  priceInput: {
    border: 'none',
    outline: 'none',
    padding: '10px 0',
    fontSize: '13.5px',
    width: '100%',
    color: '#0f172a'
  },
  lockedField: {
    padding: '10px 12px',
    borderRadius: '4px',
    background: '#f8fafc',
    border: '1px solid #cbd5e1',
    fontSize: '13.5px',
    display: 'flex',
    flexDirection: 'column'
  },
  lockedNote: {
    fontSize: '11px',
    color: '#64748b',
    marginTop: '2px'
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
    borderRadius: '4px',
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
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '13.5px'
  },
  errorBox: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '4px',
    fontSize: '13px',
    border: '1px solid #fecdd3',
    marginBottom: '14px'
  },

  // Service View Details Modal Metadata
  modalMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '12px',
    marginBottom: '20px'
  },
  metaCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  metaLabel: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  },
  metaValue: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#0f172a'
  },
  modalScopeContainer: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '18px 20px'
  },
  modalScopeHeading: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    color: '#0f172a',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px',
    fontWeight: '700'
  },
  modalScopeList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#334155',
    fontSize: '13.5px',
    lineHeight: '1.65'
  },
  modalScopeMainItem: {
    marginBottom: '8px'
  },
  modalScopeSubItem: {
    listStyleType: 'none',
    marginLeft: '14px',
    marginBottom: '6px',
    fontFamily: 'monospace',
    fontSize: '12.5px',
    color: '#475569'
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '22px',
    paddingTop: '16px',
    borderTop: '1px solid #e2e8f0'
  },
  modalCloseActionBtn: {
    padding: '9px 18px',
    background: '#f1f5f9',
    color: '#334155',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  modalEditActionBtn: {
    padding: '9px 18px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  }
};

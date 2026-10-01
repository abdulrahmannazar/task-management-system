import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';

export default function ServiceManager() {
  const [services, setServices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('ALL');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  const isAdmin = user?.role === 'ADMIN';
  const userDeptId = user?.department_id || 1;

  const [formData, setFormData] = useState({
    department_id: isAdmin ? '' : userDeptId,
    name: '',
    sub_category: '',
    billing_type: 'Fixed',
    price: '',
    scope: '',
    is_active: true
  });

  useEffect(() => {
    fetchServices();
    fetchDepartments();
  }, []);

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

  const handleEdit = (srv) => {
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const getDepartmentName = (deptId) => {
    const found = departments.find(d => d.department_id === Number(deptId));
    return found ? found.name : `Dept #${deptId}`;
  };

  const displayedServices = services.filter((srv) => {
    if (!isAdmin || selectedDeptFilter === 'ALL') return true;
    return srv.department_id === Number(selectedDeptFilter);
  });

  return (
    <div style={styles.pageContainer}>
      <Navbar />
      <div style={styles.container}>
        
        {/* Left Form: Add / Edit Service */}
        <div style={styles.formSection}>
          <h2>{editingId ? `Edit Service #${editingId}` : 'Add New Service'}</h2>
          <p style={{ margin: '-5px 0 15px', color: '#6c757d', fontSize: '13px' }}>
            Set service categories, deliverables, default scope, and base pricing.
          </p>

          {error && <div style={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Department */}
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

            {/* Service Name */}
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

            {/* Sub-Category & Billing Type */}
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

            {/* Base Price */}
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Base Price / Standard Fee (USD / LKR) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="e.g. 500.00"
                required
                style={styles.input}
              />
              <span style={{ fontSize: '11px', color: '#6c757d' }}>
                Default price that auto-populates when added to an LOE.
              </span>
            </div>

            {/* Default Scope Template */}
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
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
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
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
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
                  }}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Right Directory: Services List */}
        <div style={styles.listSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <h2 style={{ margin: 0 }}>
                {isAdmin ? 'All Standard Services' : `${getDepartmentName(userDeptId)} Services`}
              </h2>
              <p style={{ margin: '4px 0 0 0', color: '#6c757d', fontSize: '13px' }}>
                {displayedServices.length} registered service{displayedServices.length === 1 ? '' : 's'}.
              </p>
            </div>

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
          </div>

          {displayedServices.length === 0 ? (
            <p>No services registered in this department yet.</p>
          ) : (
            <div style={styles.grid}>
              {displayedServices.map((srv) => (
                <div key={srv.service_id} style={styles.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '16px', color: '#1a202c' }}>{srv.name}</h3>
                      <span style={styles.categoryBadge}>{srv.sub_category || 'Standard'}</span>
                      <span style={styles.deptBadge}>
                        {srv.department?.name || getDepartmentName(srv.department_id)}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={styles.priceBadge}>
                        ${Number(srv.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                        {srv.billing_type}
                      </div>
                    </div>
                  </div>

                  {srv.scope && (
                    <div style={styles.scopePreviewBox}>
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#6c757d' }}>Default Scope:</span>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#4a5568', whiteSpace: 'pre-line' }}>
                        {srv.scope}
                      </p>
                    </div>
                  )}

                  <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: srv.is_active ? '#28a745' : '#dc3545', fontWeight: 'bold' }}>
                      {srv.is_active ? '● Active' : '○ Inactive'}
                    </span>
                    <button onClick={() => handleEdit(srv)} style={styles.editBtn}>
                      Edit Service &amp; Price
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { display: 'flex', gap: '40px', padding: '40px' },
  formSection: { flex: '1.1', background: '#fff', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', height: 'fit-content' },
  listSection: { flex: '1.9' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '15px' },
  formRow: { display: 'flex', gap: '12px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '12px', fontWeight: 'bold', color: '#4a5568' },
  input: { padding: '9px 10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13.5px' },
  lockedField: { padding: '9px 10px', borderRadius: '4px', background: '#e9ecef', border: '1px solid #ced4da', fontSize: '13.5px', display: 'flex', flexDirection: 'column' },
  lockedNote: { fontSize: '11px', color: '#6c757d', marginTop: '2px' },
  buttonGroup: { display: 'flex', gap: '10px', marginTop: '10px' },
  button: { flex: '1', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  cancelButton: { flex: '1', padding: '10px', background: '#6c757d', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  errorBox: { padding: '10px 14px', background: '#fed7d7', color: '#c53030', borderRadius: '4px', fontSize: '13px', border: '1px solid #feb2b2' },
  filterDropdown: { padding: '8px 12px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px', background: '#fff', fontWeight: 'bold' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: { background: '#fff', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' },
  categoryBadge: { background: '#e2e8f0', color: '#4a5568', padding: '2px 6px', borderRadius: '3px', fontSize: '11px', marginRight: '6px' },
  deptBadge: { background: '#edf2f7', color: '#2b6cb0', padding: '2px 6px', borderRadius: '3px', fontSize: '11px' },
  priceBadge: { background: '#e6fffa', color: '#234e52', padding: '3px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #b2f5ea' },
  scopePreviewBox: { marginTop: '10px', background: '#f8fafc', padding: '8px 10px', borderRadius: '4px', border: '1px solid #edf2f7' },
  editBtn: { padding: '6px 12px', background: '#f8f9fa', color: '#007bff', border: '1px solid #ced4da', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }
};
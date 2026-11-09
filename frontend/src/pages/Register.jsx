import React, { useState, useEffect } from 'react';
import { API_BASE } from '../utils/api';
import { useNavigate, Link } from 'react-router-dom';
import FrontierLogo from '../components/FrontierLogo';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    department_id: ''
  });
  const [departments, setDepartments] = useState([]);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/departments`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setDepartments(data);
          if (data.length > 0) {
            setFormData((prev) => ({ ...prev, department_id: data[0].department_id }));
          }
        }
      })
      .catch((err) => console.error('Failed to load departments', err));
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          department_id: Number(formData.department_id)
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Registration failed');

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.employee || data.user));
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.brandHeader}>
          <FrontierLogo size={200} />
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.field}>
          <label style={styles.label}>Full Name</label>
          <input 
            type="text" 
            name="name" 
            value={formData.name}
            onChange={handleChange} 
            required 
            placeholder="e.g. John Doe"
            style={styles.input} 
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Email Address</label>
          <input 
            type="email" 
            name="email" 
            value={formData.email}
            onChange={handleChange} 
            required 
            placeholder="john@frontieradvisory.com"
            style={styles.input} 
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Password</label>
          <input 
            type="password" 
            name="password" 
            value={formData.password}
            onChange={handleChange} 
            required 
            placeholder="••••••••"
            style={styles.input} 
          />
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Department</label>
          <select 
            name="department_id" 
            value={formData.department_id}
            onChange={handleChange} 
            style={styles.input}
          >
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Role</label>
          <select 
            name="role" 
            value={formData.role}
            onChange={handleChange} 
            style={styles.input}
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        <button type="submit" style={styles.button}>Register Account</button>

        <p style={styles.footerText}>
          Already registered? <Link to="/login" style={styles.link}>Sign in here</Link>
        </p>
      </form>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: '#f8fafc',
    fontFamily: 'system-ui',
    padding: '24px'
  },
  form: {
    padding: '36px 32px',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',
    width: '100%',
    maxWidth: '410px',
    background: '#ffffff',
    border: '1px solid #e2e8f0'
  },
  brandHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: '22px'
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: '800',
    color: '#0f172a',
    margin: '10px 0 2px',
    letterSpacing: '-0.3px'
  },
  brandSubtitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#0284c7',
    letterSpacing: '0.2px'
  },
  field: {
    marginBottom: '15px',
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
    fontSize: '14px',
    background: '#ffffff',
    color: '#0f172a'
  },
  button: {
    width: '100%',
    padding: '11px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    marginTop: '8px',
    transition: 'background 0.15s ease'
  },
  error: {
    padding: '10px 14px',
    background: '#fff1f2',
    color: '#e11d48',
    borderRadius: '6px',
    marginBottom: '16px',
    fontSize: '13px',
    textAlign: 'center',
    border: '1px solid #fecdd3'
  },
  footerText: {
    textAlign: 'center',
    marginTop: '18px',
    fontSize: '13px',
    color: '#64748b'
  },
  link: {
    color: '#0284c7',
    fontWeight: '600',
    textDecoration: 'none'
  }
};

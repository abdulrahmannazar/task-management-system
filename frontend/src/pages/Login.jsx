import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import FrontierLogo from '../components/FrontierLogo';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please check credentials.');
      }

      // Clear any prior session state
      localStorage.clear();

      // Store authentic JWT and database user profile
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify({
        emp_id: data.user.emp_id,
        name: data.user.name,
        email: data.user.email,
        role: data.user.role, // Dynamic: reflects database role
        department_id: data.user.department_id,
        department_name: data.user.department_name
      }));

      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.brandHeader}>
          <FrontierLogo size={220} />
        </div>

        <h3 style={styles.formTitle}>Sign In to Account</h3>
        
        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email Address</label>
            <input 
              type="email" 
              name="email" 
              value={formData.email} 
              onChange={handleChange} 
              required 
              placeholder="name@company.com" 
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

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <p style={styles.footerText}>
          Don't have an account? <Link to="/register" style={styles.registerLink}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    fontFamily: 'system-ui',
    padding: '20px'
  },
  card: {
    background: '#ffffff',
    padding: '36px 32px',
    borderRadius: '12px',
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 4px 6px -2px rgba(15, 23, 42, 0.04)',
    border: '1px solid #e2e8f0',
    width: '100%',
    maxWidth: '410px'
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
  formTitle: {
    textAlign: 'center',
    color: '#334155',
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '20px',
    borderBottom: '1px solid #f1f5f9',
    paddingBottom: '12px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
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
    padding: '11px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '700',
    fontSize: '14px',
    marginTop: '6px',
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
    marginTop: '20px',
    fontSize: '13px',
    color: '#64748b'
  },
  registerLink: {
    color: '#0284c7',
    fontWeight: '600',
    textDecoration: 'none'
  }
};

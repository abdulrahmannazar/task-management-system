import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Task Management System</h2>
        <h3 style={{ textAlign: 'center', color: '#555', marginBottom: '20px' }}>Login</h3>
        
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
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '15px', fontSize: '13px' }}>
          Don't have an account? <Link to="/register" style={{ color: '#007bff' }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  container: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f4f6f8', fontFamily: 'system-ui' },
  card: { background: '#fff', padding: '30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', width: '100%', maxWidth: '380px' },
  form: { display: 'flex', flexDirection: 'column', gap: '15px' },
  field: { display: 'flex', flexDirection: 'column', gap: '5px' },
  label: { fontSize: '13px', fontWeight: 'bold', color: '#495057' },
  input: { padding: '10px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '14px' },
  button: { padding: '11px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', marginTop: '5px' },
  error: { padding: '10px', background: '#f8d7da', color: '#721c24', borderRadius: '4px', marginBottom: '15px', fontSize: '13px', textAlign: 'center' }
};
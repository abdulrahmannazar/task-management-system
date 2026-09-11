import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await fetch('https://task-management-system-6ifq.onrender.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');

      const userData = data.employee || data.user || { 
        name: 'Authorized User', 
        email: formData.email,
        role: 'ADMIN',
        department_id: 1 
      };

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.container}>
      <form onSubmit={handleSubmit} style={styles.form}>
        <h2>System Login</h2>
        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.field}>
          <label>Email</label>
          <input type="email" name="email" onChange={handleChange} required style={styles.input} />
        </div>

        <div style={styles.field}>
          <label>Password</label>
          <input type="password" name="password" onChange={handleChange} required style={styles.input} />
        </div>

        <button type="submit" style={styles.button}>Login</button>
        <p style={{ marginTop: '15px', fontSize: '14px', textAlign: 'center' }}>
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  form: { padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '350px', background: '#fff' },
  field: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  input: { padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { width: '100%', padding: '10px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  error: { color: 'red', marginBottom: '10px', fontSize: '14px' }
};
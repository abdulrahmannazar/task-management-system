import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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
    fetch('http://localhost:3000/api/auth/departments')
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
      const response = await fetch('http://localhost:3000/api/auth/register', {
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
        <h2>Employee Registration</h2>
        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.field}>
          <label>Full Name</label>
          <input type="text" name="name" onChange={handleChange} required style={styles.input} />
        </div>

        <div style={styles.field}>
          <label>Email Address</label>
          <input type="email" name="email" onChange={handleChange} required style={styles.input} />
        </div>

        <div style={styles.field}>
          <label>Password</label>
          <input type="password" name="password" onChange={handleChange} required style={styles.input} />
        </div>

        <div style={styles.field}>
          <label>Department</label>
          <select name="department_id" onChange={handleChange} style={styles.input}>
            {departments.map((dept) => (
              <option key={dept.department_id} value={dept.department_id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label>Role</label>
          <select name="role" onChange={handleChange} style={styles.input}>
            <option value="EMPLOYEE">Employee</option>
            <option value="MANAGER">Manager</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>

        <button type="submit" style={styles.button}>Register</button>
      </form>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  form: { padding: '30px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', width: '350px', background: '#fff' },
  field: { marginBottom: '15px', display: 'flex', flexDirection: 'column' },
  input: { padding: '10px', marginTop: '5px', borderRadius: '4px', border: '1px solid #ccc' },
  button: { width: '100%', padding: '10px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  error: { color: 'red', marginBottom: '10px', fontSize: '14px' }
};
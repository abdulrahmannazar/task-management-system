import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login'); // Change this line
  };
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  return (
    <nav style={styles.nav}>
      <h2 style={styles.brand}>Task System</h2>
      <div style={styles.links}>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/loes" style={styles.link}>LOE Manager</Link>
        {(user.role === 'MANAGER' || user.role === 'ADMIN') && (<Link to="/approvals" style={styles.link}>Approvals</Link>)}
        {(user.role === 'MANAGER' || user.role === 'ADMIN') && (<Link to="/services" style={styles.link}>Services</Link>)}

        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>

      </div>
    </nav>
  );
}

const styles = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', background: '#343a40', color: '#fff', fontFamily: 'system-ui' },
  brand: { margin: 0 },
  links: { display: 'flex', gap: '20px', alignItems: 'center' },
  link: { color: '#fff', textDecoration: 'none', fontWeight: 'bold' },
  logoutBtn: { padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }
};
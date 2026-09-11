import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    
    // Safely check if data exists AND is not the string "undefined"
    if (storedUser && storedUser !== 'undefined') {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error("Failed to parse user data", e);
        navigate('/login');
      }
    } else {
      // Clear bad data and redirect to login
      localStorage.removeItem('user');
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div style={styles.dashboardContainer}>
      <Navbar />
      <main style={styles.main}>
        <div style={styles.card}>
          <h3>Welcome back, {user?.name || 'User'}!</h3>
          <p><strong>Email:</strong> {user?.email || 'N/A'}</p>
          <p><strong>Role:</strong> {user?.role || 'N/A'}</p>
          <p><strong>Department ID:</strong> {user?.department_id || 'N/A'}</p>
        </div>
      </main>
    </div>
  );
}

const styles = {
  dashboardContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  main: { padding: '40px' },
  card: { background: '#fff', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', maxWidth: '400px' }
};
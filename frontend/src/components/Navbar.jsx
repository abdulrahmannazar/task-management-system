import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  const isPrivileged = user.role === 'MANAGER' || user.role === 'ADMIN';

  useEffect(() => {
    if (token) {
      fetchNotifications();
      // Auto-poll notifications every 5 seconds
      const interval = setInterval(fetchNotifications, 5000);
      return () => clearInterval(interval);
    }
  }, [token]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('https://task-management-system-6ifq.onrender.com/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data) ? data : []);
      }
    } catch (e) {}
  };

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`https://task-management-system-6ifq.onrender.com/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: true } : n));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`https://task-management-system-6ifq.onrender.com/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {}
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <nav style={styles.nav}>
      <h2 style={styles.brand}>Task System</h2>
      <div style={styles.links}>
        <Link to="/dashboard" style={styles.link}>Dashboard</Link>
        <Link to="/loes" style={styles.link}>LOE Manager</Link>
        
        {isPrivileged && <Link to="/approvals" style={styles.link}>Approvals</Link>}
        
        <Link to="/tasks" style={styles.link}>
          {isPrivileged ? 'Task Allocation' : 'My Tasks'}
        </Link>

        {isPrivileged && <Link to="/invoices" style={styles.link}>Invoices</Link>}
        {isPrivileged && <Link to="/employees" style={styles.link}>Employees</Link>}
        {isPrivileged && <Link to="/services" style={styles.link}>Services</Link>}
        {isPrivileged && <Link to="/companies" style={styles.link}>Companies</Link>}
        
        {/* Real-time Notification Bell */}
        <div style={styles.notifContainer}>
          <button onClick={() => setShowNotifs(!showNotifs)} style={styles.bellBtn} title="Notifications">
            🔔
            {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
          </button>
          
          {showNotifs && (
            <div style={styles.notifDropdown}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: 0, fontSize: '13px', color: '#1a365d' }}>Notifications</h4>
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} style={styles.markAllBtn}>
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <p style={{ margin: 0, fontSize: '12px', color: '#718096' }}>No notifications yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.map(n => (
                    <div 
                      key={n.notification_id} 
                      onClick={() => !n.is_read && handleMarkAsRead(n.notification_id)}
                      style={{
                        padding: '10px', 
                        borderRadius: '4px', 
                        background: n.is_read ? '#f8fafc' : '#e6fffa',
                        border: `1px solid ${n.is_read ? '#e2e8f0' : '#b2f5ea'}`,
                        cursor: n.is_read ? 'default' : 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12px', color: '#2d3748' }}>{n.title}</strong>
                        {!n.is_read && <span style={styles.unreadDot}>●</span>}
                      </div>
                      <span style={{ fontSize: '11px', color: '#4a5568', marginTop: '2px', display: 'block' }}>
                        {n.message}
                      </span>
                      <span style={{ fontSize: '10px', color: '#a0aec0', marginTop: '4px', display: 'block' }}>
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(n.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 40px', background: '#343a40', color: '#fff', fontFamily: 'system-ui', position: 'relative', zIndex: 9999 },
  brand: { margin: 0 },
  links: { display: 'flex', gap: '20px', alignItems: 'center' },
  link: { color: '#fff', textDecoration: 'none', fontWeight: 'bold' },
  logoutBtn: { padding: '8px 15px', background: '#dc3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' },
  notifContainer: { position: 'relative' },
  bellBtn: { background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', position: 'relative' },
  badge: { position: 'absolute', top: '-4px', right: '-6px', background: '#dc3545', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px' },
  unreadDot: { color: '#28a745', fontSize: '12px' },
  markAllBtn: { background: 'none', border: 'none', color: '#007bff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: 0 },
  notifDropdown: { position: 'absolute', top: '35px', right: '0', width: '310px', maxHeight: '380px', overflowY: 'auto', background: '#fff', padding: '15px', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: '1px solid #e2e8f0', color: '#000', zIndex: 1000 }
};
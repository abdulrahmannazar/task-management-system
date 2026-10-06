import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [browserPermission, setBrowserPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};
  const isPrivileged = user.role === 'MANAGER' || user.role === 'ADMIN';

  // Track seen IDs so we only trigger popups for newly arrived alerts
  const seenNotifIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);

  // Soft audio chime using Web Audio API (zero external assets needed)
  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

  // Request native browser desktop notification permission
  const requestBrowserPermission = async () => {
    if ('Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setBrowserPermission(perm);
      } catch (err) {
        console.error('Notification permission error:', err);
      }
    }
  };

  // Trigger both on-screen visual toast and native OS desktop Web Push popup
  const triggerNotificationPopups = (notif) => {
    // 1. In-App Floating Toast Card
    const toastId = `${notif.notification_id}-${Date.now()}`;
    const newToast = {
      id: toastId,
      notification_id: notif.notification_id,
      title: notif.title,
      message: notif.message,
      created_at: notif.created_at
    };

    setToasts((prev) => [newToast, ...prev].slice(0, 4));
    playChime();

    // Auto-dismiss the floating toast after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 6000);

    // 2. Native Browser Desktop Notification (Web Push)
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotif = new Notification(notif.title || 'Task Management Alert', {
          body: notif.message || 'You have an update on your assigned task.',
          icon: '/favicon.svg'
        });

        browserNotif.onclick = () => {
          window.focus();
          browserNotif.close();
        };
      } catch (err) {
        console.warn('Native desktop notification failed:', err);
      }
    }
  };

  const fetchNotifications = async () => {
    if (!token) return;
    try {
      const res = await fetch('https://task-management-system-6ifq.onrender.com/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setNotifications(list);

        const unreadItems = list.filter((n) => !n.is_read);

        if (isFirstLoadRef.current) {
          // On initial page load, record existing IDs to prevent spamming popups for old history
          unreadItems.forEach((n) => seenNotifIdsRef.current.add(n.notification_id));
          isFirstLoadRef.current = false;
        } else {
          // Trigger popups for any newly arrived unread notification
          unreadItems.forEach((n) => {
            if (!seenNotifIdsRef.current.has(n.notification_id)) {
              seenNotifIdsRef.current.add(n.notification_id);
              triggerNotificationPopups(n);
            }
          });
        }
      }
    } catch (e) {
      console.error('Failed to poll notifications:', e);
    }
  };

  useEffect(() => {
    if (token) {
      fetchNotifications();
      // Fast polling every 4 seconds for immediate responsiveness
      const interval = setInterval(fetchNotifications, 4000);
      return () => clearInterval(interval);
    }
  }, [token]);

  // Prompt for desktop Web Push permissions on mount if still default
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      requestBrowserPermission();
    }
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      await fetch(`https://task-management-system-6ifq.onrender.com/api/notifications/${id}/read`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) =>
        prev.map((n) => (n.notification_id === id ? { ...n, is_read: true } : n))
      );
      setToasts((prev) => prev.filter((t) => t.notification_id !== id));
    } catch (e) {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch(`https://task-management-system-6ifq.onrender.com/api/notifications/read-all`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setToasts([]);
    } catch (e) {}
  };

  const handleDismissToast = (e, toastId) => {
    e.stopPropagation();
    setToasts((prev) => prev.filter((t) => t.id !== toastId));
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <>
      <style>{`
        @keyframes slideInUp {
          from {
            transform: translateY(30px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .toast-popup-item {
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

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
          
          {/* Notification Bell */}
          <div style={styles.notifContainer}>
            <button onClick={() => setShowNotifs(!showNotifs)} style={styles.bellBtn} title="Notifications">
              🔔
              {unreadCount > 0 && <span style={styles.badge}>{unreadCount}</span>}
            </button>
            
            {showNotifs && (
              <div style={styles.notifDropdown}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '13px', color: '#1a365d' }}>Notifications</h4>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} style={styles.markAllBtn}>
                      Mark all read
                    </button>
                  )}
                </div>

                {browserPermission !== 'granted' && (
                  <div style={styles.permissionPrompt}>
                    <span>Enable native desktop popups?</span>
                    <button onClick={requestBrowserPermission} style={styles.enableBtn}>
                      Allow
                    </button>
                  </div>
                )}

                {notifications.length === 0 ? (
                  <p style={{ margin: 0, fontSize: '12px', color: '#718096', padding: '10px 0' }}>
                    No notifications yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                    {notifications.map((n) => (
                      <div 
                        key={n.notification_id} 
                        onClick={() => !n.is_read && handleMarkAsRead(n.notification_id)}
                        style={{
                          padding: '10px', 
                          borderRadius: '6px', 
                          background: n.is_read ? '#f8fafc' : '#e6fffa',
                          border: `1px solid ${n.is_read ? '#e2e8f0' : '#b2f5ea'}`,
                          cursor: n.is_read ? 'default' : 'pointer',
                          transition: 'background 0.2s ease'
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

      {/* Floating On-Screen Toast Popup Container */}
      <div style={styles.toastContainer}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-popup-item"
            onClick={() => handleMarkAsRead(toast.notification_id)}
            style={styles.toastCard}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={styles.toastIcon}>🔔</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#1a365d' }}>{toast.title}</strong>
                  <button
                    onClick={(e) => handleDismissToast(e, toast.id)}
                    style={styles.toastCloseBtn}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#4a5568', lineHeight: '1.4' }}>
                  {toast.message}
                </p>
                <span style={{ fontSize: '10px', color: '#718096', marginTop: '4px', display: 'block' }}>
                  Just now &bull; Click to mark as read
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
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
  notifDropdown: { position: 'absolute', top: '35px', right: '0', width: '320px', maxHeight: '420px', overflowY: 'auto', background: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', border: '1px solid #e2e8f0', color: '#000', zIndex: 10000 },
  permissionPrompt: { background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: '#0369a1' },
  enableBtn: { background: '#0284c7', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' },
  
  // Floating Toast Container
  toastContainer: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 999999,
    pointerEvents: 'none',
    maxWidth: '380px',
    width: '100%'
  },
  toastCard: {
    pointerEvents: 'auto',
    background: '#ffffff',
    borderLeft: '4px solid #0284c7',
    borderTop: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
    borderBottom: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '14px 16px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    cursor: 'pointer',
    fontFamily: 'system-ui'
  },
  toastIcon: {
    fontSize: '20px',
    lineHeight: '1',
    marginTop: '2px'
  },
  toastCloseBtn: {
    background: 'transparent',
    border: 'none',
    fontSize: '14px',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: '1'
  }
};
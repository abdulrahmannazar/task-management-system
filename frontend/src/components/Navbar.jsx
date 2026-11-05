import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { usePermissions } from '../utils/permissionHelper';
import FrontierLogo from './FrontierLogo';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermissions();

  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showSupportModal, setShowSupportModal] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  // Persistent sidebar collapse state
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('frontier_sidebar_collapsed') === 'true';
    }
    return false;
  });

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const seenNotifIdsRef = useRef(new Set());
  const isFirstLoadRef = useRef(true);
  const notifDropdownRef = useRef(null);

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setShowNotifs(false);
      }
    };
    if (showNotifs) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifs]);

  // Sync sidebar width CSS variable to root element
  useEffect(() => {
    const width = isCollapsed ? '72px' : '260px';
    document.documentElement.style.setProperty('--sidebar-width', width);
    if (isCollapsed) {
      document.body.classList.add('sidebar-collapsed');
    } else {
      document.body.classList.remove('sidebar-collapsed');
    }
    localStorage.setItem('frontier_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  }, [isCollapsed]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => !prev);
  };

  const playChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  };

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

  const triggerNotificationPopups = (notif) => {
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

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
    }, 6000);

    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const browserNotif = new Notification(notif.title || 'Task Management Alert', {
          body: notif.message || 'You have an update on your assigned task.',
          icon: '/logo-icon.png'
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
          unreadItems.forEach((n) => seenNotifIdsRef.current.add(n.notification_id));
          isFirstLoadRef.current = false;
        } else {
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
      const interval = setInterval(fetchNotifications, 4000);
      return () => clearInterval(interval);
    }
  }, [token]);

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

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Navigation Items Specification matching reference layout exactly:
  // 1. Dashboard
  // 2. LOE [Projects]
  // 3. Tasks Allocation
  // 4. Employees
  // 5. Invoices
  // 6. Client Dispatch
  // 7. Approvals
  // 8. Services
  // 9. Companies
  const navItems = [
    {
      label: 'Dashboard',
      path: '/dashboard',
      permission: null,
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    },
    {
      label: 'LOE [Projects]',
      path: '/loes',
      permission: 'VIEW_LOES',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          <path d="M8 13h8" />
          <path d="M8 17h5" />
        </svg>
      )
    },
    {
      label: 'Tasks Allocation',
      path: '/tasks',
      permission: 'VIEW_TASKS',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
          <rect x="9" y="3" width="6" height="4" rx="1" />
          <path d="m9 14 2 2 4-4" />
        </svg>
      )
    },
    {
      label: 'Employees',
      path: '/employees',
      permission: 'VIEW_EMPLOYEES',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    },
    {
      label: 'Invoices',
      path: '/invoices',
      permission: 'VIEW_INVOICES',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
          <path d="M14 9h5v5" />
        </svg>
      )
    },
    {
      label: 'Client Dispatch',
      path: '/dispatch',
      permission: 'VIEW_DISPATCH',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.3-4.03A1 1 0 0 0 17.7 8H14v10Z" />
          <circle cx="7" cy="18" r="2" />
          <circle cx="17" cy="18" r="2" />
        </svg>
      )
    },
    {
      label: 'Approvals',
      path: '/approvals',
      permission: 'VIEW_APPROVALS',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      )
    },
    {
      label: 'Services',
      path: '/services',
      permission: 'VIEW_SERVICES',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m21 7.5-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
        </svg>
      )
    },
    {
      label: 'Companies',
      path: '/companies',
      permission: 'VIEW_COMPANIES',
      icon: (active) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? '#0284c7' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <path d="M9 22v-4h6v4" />
          <path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
        </svg>
      )
    }
  ];

  const isRouteActive = (targetPath) => {
    if (targetPath === '/dashboard') return location.pathname === '/dashboard';
    if (targetPath === '/loes') return location.pathname.startsWith('/loes');
    return location.pathname === targetPath;
  };

  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/loes/')) return 'LOE Details';
    const found = navItems.find((item) => item.path === pathname);
    if (found) return found.label;
    if (pathname === '/settings') return 'Settings';
    return 'Task Management';
  };

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
        @keyframes fadeInDownScale {
          from {
            transform: translateY(-8px) scale(0.97);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .toast-popup-item {
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .nav-item-link:hover {
          background-color: #f0f9ff !important;
          color: #0369a1 !important;
        }
        .nav-item-link:hover svg {
          stroke: #0284c7 !important;
        }
        .sidebar-toggle-btn:hover {
          background-color: #f1f5f9 !important;
          border-color: #94a3b8 !important;
          color: #0f172a !important;
        }
        .top-utility-btn:hover {
          background-color: #f8fafc !important;
          border-color: #0284c7 !important;
          color: #0284c7 !important;
          box-shadow: 0 4px 10px -2px rgba(2, 132, 199, 0.2) !important;
          transform: translateY(-1px);
        }
        .sidebar-nav-scroll {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }
        .sidebar-nav-scroll::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
        }
      `}</style>

      {/* FIXED SIDEBAR NAVIGATION (NO VERTICAL SCROLLBAR) */}
      <aside
        style={{
          ...styles.sidebar,
          width: isCollapsed ? '72px' : '260px'
        }}
        aria-label="Sidebar Navigation"
      >
        {/* Header: Official Frontier Advisory Logo */}
        <div style={styles.header}>
          {isCollapsed ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <FrontierLogo size={36} iconOnly={true} />
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '0' }}>
              <FrontierLogo size={160} />
            </div>
          )}
        </div>

        {/* Navigation List: Fits comfortably within viewport */}
        <nav style={styles.navScrollArea} className="sidebar-nav-scroll">
          <ul style={styles.navList}>
            {navItems.map((item) => {
              if (item.permission && !hasPermission(user, item.permission)) {
                return null;
              }

              const active = isRouteActive(item.path);

              return (
                <li key={item.path} style={styles.navLi}>
                  <Link
                    to={item.path}
                    className="nav-item-link"
                    title={isCollapsed ? item.label : undefined}
                    style={{
                      ...styles.navLink,
                      ...(active ? styles.navLinkActive : {}),
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      padding: isCollapsed ? '8.5px 0' : '8.5px 18px'
                    }}
                  >
                    <span style={styles.iconSpan}>{item.icon(active)}</span>
                    {!isCollapsed && (
                      <span style={{ ...styles.labelSpan, ...(active ? styles.labelSpanActive : {}) }}>
                        {item.label}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Pinned Section: Support & Collapse Footer ONLY */}
        <div style={styles.bottomPinned}>
          {/* Support */}
          <button
            type="button"
            onClick={() => setShowSupportModal(true)}
            className="nav-item-link"
            title={isCollapsed ? 'Support' : undefined}
            style={{
              ...styles.pinnedBtn,
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              padding: isCollapsed ? '9px 0' : '9px 18px'
            }}
          >
            <span style={styles.iconSpan}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
            {!isCollapsed && <span style={styles.labelSpan}>Support</span>}
          </button>

          {/* Footer Bar: "Frontier Advisory" & Collapse Toggle [<] */}
          <div
            style={{
              ...styles.footerBar,
              justifyContent: isCollapsed ? 'center' : 'space-between',
              padding: isCollapsed ? '10px 0' : '10px 18px'
            }}
          >
            {!isCollapsed && (
              <span style={styles.footerBrandText}>Frontier Advisory</span>
            )}
            <button
              type="button"
              onClick={toggleSidebar}
              className="sidebar-toggle-btn"
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              style={styles.toggleCollapseBtn}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* STICKY TOP HEADER BAR: Pins to top of content area, never scrolls away, reserves 56px height to prevent any content overlap */}
      <header style={styles.topHeaderBar} aria-label="Top Navigation Bar">
        {/* Left Side: Breadcrumb / Current Section */}
        <div style={styles.topHeaderLeft}>
          <span style={styles.topHeaderBrand}>Frontier Advisory</span>
          <span style={styles.topHeaderDivider}>/</span>
          <span style={styles.topHeaderTitle}>{getPageTitle(location.pathname)}</span>
        </div>

        {/* Right Side: Notification Bell & Settings Gear */}
        <div style={styles.topHeaderRight}>
          {/* Notification Bell Button */}
          <div style={{ position: 'relative' }} ref={notifDropdownRef}>
            <button
              type="button"
              onClick={() => setShowNotifs((prev) => !prev)}
              className="top-utility-btn"
              title="Notifications"
              aria-label="View notifications"
              style={{
                ...styles.topUtilityBtn,
                ...(showNotifs ? styles.topUtilityBtnActive : {})
              }}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && (
                <span style={styles.topNotifBadge}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Top-Right Notifications Dropdown Panel */}
            {showNotifs && (
              <div style={styles.topNotifDropdown}>
                <div style={styles.notifHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '13.5px', color: '#0f172a', fontWeight: '700' }}>
                      Notifications
                    </h4>
                    {unreadCount > 0 && (
                      <span style={styles.unreadCountPill}>{unreadCount} new</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={handleMarkAllRead} style={styles.markAllBtn}>
                      Mark all read
                    </button>
                  )}
                </div>

                {browserPermission !== 'granted' && (
                  <div style={styles.permissionPrompt}>
                    <span style={{ fontSize: '11px', color: '#0369a1' }}>Desktop popups?</span>
                    <button onClick={requestBrowserPermission} style={styles.enableBtn}>
                      Allow
                    </button>
                  </div>
                )}

                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: '#64748b', fontSize: '12.5px' }}>
                    No notifications yet
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                    {notifications.map((n) => (
                      <div
                        key={n.notification_id}
                        onClick={() => !n.is_read && handleMarkAsRead(n.notification_id)}
                        style={{
                          padding: '9px 11px',
                          borderRadius: '7px',
                          background: n.is_read ? '#f8fafc' : '#f0f9ff',
                          border: `1px solid ${n.is_read ? '#e2e8f0' : '#bae6fd'}`,
                          cursor: n.is_read ? 'default' : 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <strong style={{ fontSize: '12px', color: '#0f172a', fontWeight: '600' }}>{n.title}</strong>
                          {!n.is_read && <span style={styles.unreadDot}>●</span>}
                        </div>
                        <span style={{ fontSize: '11.5px', color: '#334155', marginTop: '2px', display: 'block', lineHeight: '1.4' }}>
                          {n.message}
                        </span>
                        <span style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                          {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull; {new Date(n.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Settings Gear Link Button */}
          <Link
            to="/settings"
            className="top-utility-btn"
            title="Account Settings"
            aria-label="Account Settings"
            style={{
              ...styles.topUtilityBtn,
              ...(location.pathname === '/settings' ? styles.topUtilityBtnActive : {})
            }}
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
        </div>
      </header>

      {/* SUPPORT HELP MODAL */}
      {showSupportModal && (
        <div style={styles.supportModalOverlay} onClick={() => setShowSupportModal(false)}>
          <div style={styles.supportModalCard} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FrontierLogo size={32} iconOnly={true} />
                <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a' }}>Frontier Advisory Support</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSupportModal(false)}
                style={styles.supportCloseBtn}
              >
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '13.5px', color: '#475569', lineHeight: '1.5' }}>
              Welcome to the Frontier Advisory Task Management help desk. If you encounter issues, require permission modifications, or need assistance:
            </p>

            <div style={styles.supportInfoBox}>
              <div style={styles.supportRow}>
                <strong style={{ color: '#0f172a' }}>Support Desk:</strong>
                <a href="mailto:info@frontierlk.com" style={{ color: '#0284c7', textDecoration: 'none', fontWeight: '600' }}>
                  info@frontierlk.com
                </a>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowSupportModal(false)}
              style={styles.supportAcknowledgeBtn}
            >
              Got it, thanks!
            </button>
          </div>
        </div>
      )}

      {/* Floating On-Screen Toast Popup Container (Bottom Right) */}
      <div style={styles.toastContainer}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast-popup-item"
            onClick={() => handleMarkAsRead(toast.notification_id)}
            style={styles.toastCard}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={styles.toastIconWrapper}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '13px', color: '#0f172a' }}>{toast.title}</strong>
                  <button
                    onClick={(e) => handleDismissToast(e, toast.id)}
                    style={styles.toastCloseBtn}
                    title="Dismiss"
                  >
                    ✕
                  </button>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#334155', lineHeight: '1.4' }}>
                  {toast.message}
                </p>
                <span style={{ fontSize: '10px', color: '#64748b', marginTop: '4px', display: 'block' }}>
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
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    bottom: 0,
    height: '100vh',
    background: '#ffffff',
    borderRight: '1px solid #e2e8f0',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 300ms ease-in-out',
    boxShadow: '1px 0 4px rgba(15, 23, 42, 0.03)',
    userSelect: 'none'
  },
  header: {
    padding: '16px 12px',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0
  },
  navScrollArea: {
    flex: 1,
    overflowY: 'hidden', // Completely eliminates vertical scrollbar
    overflowX: 'hidden',
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column'
  },
  navList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px'
  },
  navLi: {
    margin: 0,
    padding: 0
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    textDecoration: 'none',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.15s ease-in-out',
    borderRight: '4px solid transparent'
  },
  navLinkActive: {
    backgroundColor: '#f0f9ff',
    color: '#0369a1',
    fontWeight: '700',
    borderRightColor: '#0284c7'
  },
  iconSpan: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    flexShrink: 0
  },
  labelSpan: {
    marginLeft: '12px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  labelSpanActive: {
    color: '#0369a1',
    fontWeight: '700'
  },
  bottomPinned: {
    borderTop: '1px solid #e2e8f0',
    background: '#ffffff',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '6px 0 0 0',
    flexShrink: 0
  },
  pinnedBtn: {
    background: 'transparent',
    border: 'none',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    color: '#475569',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    textAlign: 'left',
    fontFamily: 'inherit'
  },
  footerBar: {
    borderTop: '1px solid #f1f5f9',
    display: 'flex',
    alignItems: 'center',
    marginTop: '4px'
  },
  footerBrandText: {
    fontSize: '11.5px',
    color: '#94a3b8',
    fontWeight: '600',
    letterSpacing: '0.2px'
  },
  toggleCollapseBtn: {
    background: '#ffffff',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    width: '26px',
    height: '26px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#475569',
    transition: 'all 0.15s ease'
  },

  /* STICKY TOP HEADER BAR (PINS TO TOP, NO SCROLLING, RESERVES SPACE) */
  topHeaderBar: {
    position: 'sticky',
    top: 0,
    zIndex: 990,
    width: '100%',
    height: '56px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 40px',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
    boxSizing: 'border-box'
  },
  topHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  topHeaderBrand: {
    fontSize: '12.5px',
    fontWeight: '500',
    color: '#64748b'
  },
  topHeaderDivider: {
    fontSize: '12px',
    color: '#cbd5e1'
  },
  topHeaderTitle: {
    fontSize: '13.5px',
    fontWeight: '600',
    color: '#0f172a'
  },
  topHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  topUtilityBtn: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    color: '#475569',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'relative',
    textDecoration: 'none',
    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.08)',
    transition: 'all 0.18s ease-in-out',
    padding: 0
  },
  topUtilityBtnActive: {
    backgroundColor: '#f0f9ff',
    borderColor: '#7dd3fc',
    color: '#0284c7',
    boxShadow: '0 0 0 2px rgba(2, 132, 199, 0.18)'
  },
  topNotifBadge: {
    position: 'absolute',
    top: '-3px',
    right: '-3px',
    backgroundColor: '#e11d48',
    color: '#ffffff',
    fontSize: '9.5px',
    fontWeight: '800',
    minWidth: '17px',
    height: '17px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 3px',
    lineHeight: '1',
    boxShadow: '0 2px 4px rgba(225, 29, 72, 0.35)',
    border: '2px solid #ffffff'
  },
  topNotifDropdown: {
    position: 'absolute',
    top: '46px',
    right: '0',
    width: '340px',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 14px 30px rgba(15, 23, 42, 0.16), 0 4px 8px rgba(15, 23, 42, 0.05)',
    padding: '14px',
    zIndex: 10001,
    animation: 'fadeInDownScale 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards'
  },
  notifHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '8px'
  },
  unreadCountPill: {
    backgroundColor: '#e0f2fe',
    color: '#0369a1',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '10px'
  },
  markAllBtn: {
    background: 'none',
    border: 'none',
    color: '#0284c7',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer',
    padding: 0
  },
  permissionPrompt: {
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: '6px',
    padding: '6px 10px',
    marginBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  enableBtn: {
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  unreadDot: {
    color: '#059669',
    fontSize: '12px'
  },

  /* Support Modal */
  supportModalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999999,
    padding: '20px'
  },
  supportModalCard: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.2)',
    width: '100%',
    maxWidth: '460px',
    padding: '24px',
    fontFamily: 'inherit'
  },
  supportCloseBtn: {
    background: '#f1f5f9',
    border: 'none',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#475569'
  },
  supportInfoBox: {
    background: '#f8fafc',
    borderRadius: '8px',
    border: '1px solid #e2e8f0',
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px'
  },
  supportRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12.5px'
  },
  supportAcknowledgeBtn: {
    width: '100%',
    padding: '10px',
    background: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13.5px',
    cursor: 'pointer',
    transition: 'background 0.15s ease'
  },

  /* Floating Toast Popups */
  toastContainer: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    zIndex: 9999999,
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
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.08)',
    cursor: 'pointer',
    fontFamily: 'inherit'
  },
  toastIconWrapper: {
    fontSize: '18px',
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

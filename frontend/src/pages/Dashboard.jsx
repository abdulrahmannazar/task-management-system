import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

// Helper to parse long or multi-point scopes into clean bullet lists
const parseScopePoints = (scopeText) => {
  if (!scopeText) return ['Standard Service Scope'];
  const points = String(scopeText)
    .split(/\r?\n|•|●|▪|\b(?=\d+\.\s+)/)
    .map((line) => line.replace(/^[-*•●▪\d.\s]+/, '').trim())
    .filter(Boolean)
    .map((line) => line.charAt(0).toUpperCase() + line.slice(1));

  return points.length > 0 ? points : ['Standard Service Scope'];
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'loe'
  const [tasks, setTasks] = useState([]);
  const [loes, setLoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const user = userStr && userStr !== 'undefined' ? JSON.parse(userStr) : {};

  const isAdmin = user.role === 'ADMIN';
  const isManager = user.role === 'MANAGER';
  const userDeptId = user.department_id || 1;

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!token) {
      setError('Authentication token missing. Please log in again.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');

      const loeUrl = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/loes?role=ADMIN'
        : `https://task-management-system-6ifq.onrender.com/api/loes?department_id=${userDeptId}&role=${user.role || 'EMPLOYEE'}`;

      const taskUrl = isAdmin
        ? 'https://task-management-system-6ifq.onrender.com/api/tasks?role=ADMIN'
        : isManager
          ? `https://task-management-system-6ifq.onrender.com/api/tasks?role=MANAGER&department_id=${userDeptId}`
          : `https://task-management-system-6ifq.onrender.com/api/tasks?emp_id=${user.emp_id}`;

      const [loeRes, taskRes] = await Promise.all([
        fetch(loeUrl, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(taskUrl, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const loeData = await loeRes.json();
      const taskData = await taskRes.json();

      if (loeRes.ok) {
        setLoes(Array.isArray(loeData) ? loeData : loeData.loes || []);
      }
      if (taskRes.ok) {
        setTasks(Array.isArray(taskData) ? taskData : taskData.tasks || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard insights:', err);
      setError('Failed to load dashboard insights.');
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // TASK INSIGHTS CALCULATIONS
  // ==========================================
  const totalTasks = tasks.length;
  const pendingTasks = tasks.filter(t => t.status === 'Pending').length;
  const ongoingTasks = tasks.filter(
    t => t.status === 'In-Progress' || t.status === 'Ongoing'
  ).length;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const overdueTasks = tasks.filter(
    t => t.status !== 'Completed' && t.deadline && new Date(t.deadline) < today
  ).length;

  const taskCompletionRate = totalTasks > 0
    ? Math.round((completedTasks / totalTasks) * 100)
    : 0;

  // ==========================================
  // LOE INSIGHTS CALCULATIONS
  // ==========================================
  const displayedLoes = loes.filter(loe => {
    if (isAdmin) return true;
    return (loe.loe_items || []).some(item => item.service?.department_id === userDeptId);
  });

  const totalLoes = displayedLoes.length;
  const pendingLoes = displayedLoes.filter(
    l => l.status === 'Approval Pending' || l.status === 'Pending'
  ).length;
  const approvedLoes = displayedLoes.filter(l => l.status === 'Approved').length;
  const rejectedLoes = displayedLoes.filter(l => l.status === 'Rejected').length;

  const adhocLoes = displayedLoes.filter(l => l.type !== 'Retainer').length;
  const retainerLoes = displayedLoes.filter(l => l.type === 'Retainer').length;

  const loeApprovalRate = totalLoes > 0
    ? Math.round((approvedLoes / totalLoes) * 100)
    : 0;

  // Badge helpers
  const getTaskStatusBadge = (status) => {
    if (status === 'Completed') return { background: '#d4edda', color: '#155724' };
    if (status === 'In-Progress' || status === 'Ongoing') return { background: '#cce5ff', color: '#004085' };
    return { background: '#fff3cd', color: '#856404' };
  };

  const getLoeStatusBadge = (status) => {
    if (status === 'Approved') return { background: '#d4edda', color: '#155724' };
    if (status === 'Rejected') return { background: '#f8d7da', color: '#721c24' };
    return { background: '#fff3cd', color: '#856404' };
  };

  return (
    <div style={styles.pageContainer}>
      <Navbar />

      <div style={styles.container}>
        {/* Top Row: Title on Left, [Tasks] [LOE] Switcher Buttons on Right */}
        <div style={styles.topHeaderRow}>
          <div>
            <h1 style={styles.pageTitle}>Dashboard Overview</h1>
            <p style={styles.subTitle}>
              Welcome back, <strong>{user.name || 'User'}</strong> ({user.role || 'Staff'})
            </p>
          </div>

          <div style={styles.tabGroup}>
            <button
              type="button"
              onClick={() => setActiveTab('tasks')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'tasks' ? styles.activeTabBtn : {})
              }}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('loe')}
              style={{
                ...styles.tabBtn,
                ...(activeTab === 'loe' ? styles.activeTabBtn : {})
              }}
            >
              LOE
            </button>
          </div>
        </div>

        {error && <div style={styles.errorBanner}>{error}</div>}

        {/* Main Insights Box */}
        <div style={styles.insightsContainer}>
          <div style={styles.insightsHeader}>
            <h2 style={{ margin: 0, fontSize: '20px', color: '#1e293b' }}>
              {activeTab === 'tasks' ? '📋 Task Insights' : '📄 LOE Insights'}
            </h2>
            <button
              onClick={() => navigate(activeTab === 'tasks' ? '/tasks' : '/loes')}
              style={styles.gotoBtn}
            >
              {activeTab === 'tasks' ? 'Open Task Allocation →' : 'Open LOE Manager →'}
            </button>
          </div>

          {loading ? (
            <div style={styles.loadingState}>Loading insights...</div>
          ) : activeTab === 'tasks' ? (
            /* ==========================================
               TASKS INSIGHTS VIEW
               ========================================== */
            <div>
              {/* KPI Stat Cards */}
              <div style={styles.statsGrid}>
                <div style={{ ...styles.statCard, borderTop: '4px solid #3b82f6' }}>
                  <span style={styles.statLabel}>Total Tasks Created</span>
                  <span style={styles.statValue}>{totalTasks}</span>
                  <span style={styles.statSubtext}>Assigned in system</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #f59e0b' }}>
                  <span style={styles.statLabel}>Pending Tasks</span>
                  <span style={{ ...styles.statValue, color: '#d97706' }}>{pendingTasks}</span>
                  <span style={styles.statSubtext}>Awaiting start</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #0284c7' }}>
                  <span style={styles.statLabel}>Ongoing Tasks</span>
                  <span style={{ ...styles.statValue, color: '#0284c7' }}>{ongoingTasks}</span>
                  <span style={styles.statSubtext}>Currently in progress</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
                  <span style={styles.statLabel}>Completed Tasks</span>
                  <span style={{ ...styles.statValue, color: '#059669' }}>{completedTasks}</span>
                  <span style={styles.statSubtext}>{taskCompletionRate}% completion rate</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #ef4444' }}>
                  <span style={styles.statLabel}>Overdue Tasks</span>
                  <span style={{ ...styles.statValue, color: '#dc2626' }}>{overdueTasks}</span>
                  <span style={styles.statSubtext}>Past deadline</span>
                </div>
              </div>

              {/* Visual Progress Distribution Bar */}
              <div style={styles.progressSection}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#475569' }}>
                  <span>Task Status Distribution</span>
                  <span>{taskCompletionRate}% Completed</span>
                </div>
                <div style={styles.progressBarTrack}>
                  {totalTasks > 0 ? (
                    <>
                      <div
                        style={{
                          width: `${(completedTasks / totalTasks) * 100}%`,
                          background: '#10b981',
                          height: '100%'
                        }}
                        title={`Completed: ${completedTasks}`}
                      />
                      <div
                        style={{
                          width: `${(ongoingTasks / totalTasks) * 100}%`,
                          background: '#0284c7',
                          height: '100%'
                        }}
                        title={`Ongoing: ${ongoingTasks}`}
                      />
                      <div
                        style={{
                          width: `${(pendingTasks / totalTasks) * 100}%`,
                          background: '#f59e0b',
                          height: '100%'
                        }}
                        title={`Pending: ${pendingTasks}`}
                      />
                    </>
                  ) : (
                    <div style={{ width: '100%', background: '#e2e8f0', height: '100%' }} />
                  )}
                </div>
                <div style={styles.legendRow}>
                  <span style={styles.legendItem}><span style={{ ...styles.dot, background: '#10b981' }} /> Completed ({completedTasks})</span>
                  <span style={styles.legendItem}><span style={{ ...styles.dot, background: '#0284c7' }} /> Ongoing ({ongoingTasks})</span>
                  <span style={styles.legendItem}><span style={{ ...styles.dot, background: '#f59e0b' }} /> Pending ({pendingTasks})</span>
                </div>
              </div>

              {/* Recent Tasks Breakdown Table */}
              <h3 style={styles.tableHeading}>Recent Tasks Breakdown</h3>
              {tasks.length === 0 ? (
                <p style={styles.emptyText}>No tasks created yet.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Task Code</th>
                        <th style={styles.th}>Company</th>
                        <th style={styles.th}>Service / Scope</th>
                        <th style={styles.th}>Assignees</th>
                        <th style={styles.th}>Deadline</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasks.slice(0, 8).map((t) => {
                        const scopePoints = parseScopePoints(t.scope);

                        return (
                          <tr key={t.task_id} style={styles.tr}>
                            <td style={{ ...styles.td, fontWeight: 'bold', color: '#1e293b', verticalAlign: 'top' }}>
                              {t.task_code || `TSK-${t.task_id}`}
                            </td>
                            <td style={{ ...styles.td, verticalAlign: 'top' }}>
                              {t.job?.loe?.company?.name || 'N/A'}
                            </td>
                            <td style={{ ...styles.td, verticalAlign: 'top', minWidth: '320px' }}>
                              <strong style={{ display: 'block', marginBottom: '4px', color: '#0f172a' }}>
                                {t.service?.name || 'Service'}
                              </strong>
                              <ul style={styles.scopeBulletList}>
                                {scopePoints.map((pt, idx) => (
                                  <li key={idx} style={styles.scopeBulletItem}>
                                    {pt}
                                  </li>
                                ))}
                              </ul>
                            </td>
                            <td style={{ ...styles.td, verticalAlign: 'top' }}>
                              {t.assignees && t.assignees.length > 0
                                ? t.assignees.map(a => a.name).join(', ')
                                : <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>}
                            </td>
                            <td style={{ ...styles.td, verticalAlign: 'top' }}>
                              {t.deadline ? new Date(t.deadline).toLocaleDateString() : 'Not set'}
                            </td>
                            <td style={{ ...styles.td, verticalAlign: 'top' }}>
                              <span style={{ ...styles.badge, ...getTaskStatusBadge(t.status) }}>
                                {t.status === 'In-Progress' ? 'Ongoing' : t.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ==========================================
               LOE INSIGHTS VIEW
               ========================================== */
            <div>
              {/* KPI Stat Cards */}
              <div style={styles.statsGrid}>
                <div style={{ ...styles.statCard, borderTop: '4px solid #6366f1' }}>
                  <span style={styles.statLabel}>Total LOEs Created</span>
                  <span style={styles.statValue}>{totalLoes}</span>
                  <span style={styles.statSubtext}>Adhoc: {adhocLoes} | Retainer: {retainerLoes}</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #f59e0b' }}>
                  <span style={styles.statLabel}>Pending Approval</span>
                  <span style={{ ...styles.statValue, color: '#d97706' }}>{pendingLoes}</span>
                  <span style={styles.statSubtext}>Awaiting manager sign-off</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #10b981' }}>
                  <span style={styles.statLabel}>Approved LOEs</span>
                  <span style={{ ...styles.statValue, color: '#059669' }}>{approvedLoes}</span>
                  <span style={styles.statSubtext}>{loeApprovalRate}% approval rate</span>
                </div>

                <div style={{ ...styles.statCard, borderTop: '4px solid #ef4444' }}>
                  <span style={styles.statLabel}>Rejected LOEs</span>
                  <span style={{ ...styles.statValue, color: '#dc2626' }}>{rejectedLoes}</span>
                  <span style={styles.statSubtext}>Requires scope revision</span>
                </div>
              </div>

              {/* Recent LOEs Breakdown Table */}
              <h3 style={styles.tableHeading}>Recent Letters of Engagement</h3>
              {displayedLoes.length === 0 ? (
                <p style={styles.emptyText}>No Letters of Engagement found.</p>
              ) : (
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>LOE Code</th>
                        <th style={styles.th}>Company</th>
                        <th style={styles.th}>Type &amp; Billing</th>
                        <th style={styles.th}>Start Date</th>
                        <th style={styles.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLoes.slice(0, 8).map((loe) => (
                        <tr
                          key={loe.loe_id}
                          onClick={() => navigate(`/loes/${loe.loe_id}`)}
                          style={{ ...styles.tr, cursor: 'pointer' }}
                        >
                          <td style={{ ...styles.td, fontWeight: 'bold', color: '#2563eb' }}>
                            {loe.loe_code || `LOE #${loe.loe_id}`}
                          </td>
                          <td style={styles.td}>{loe.company?.name || 'N/A'}</td>
                          <td style={styles.td}>
                            <strong>{loe.type || 'Adhoc'}</strong> ({loe.billing_frequency || 'One-Time'})
                          </td>
                          <td style={styles.td}>
                            {loe.start_date ? new Date(loe.start_date).toLocaleDateString() : 'N/A'}
                          </td>
                          <td style={styles.td}>
                            <span style={{ ...styles.badge, ...getLoeStatusBadge(loe.status) }}>
                              {loe.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  pageContainer: { minHeight: '100vh', background: '#f4f6f8', fontFamily: 'system-ui' },
  container: { maxWidth: '1240px', margin: '0 auto', padding: '35px 40px' },
  topHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    flexWrap: 'wrap',
    gap: '16px'
  },
  pageTitle: { margin: 0, fontSize: '26px', color: '#1e293b' },
  subTitle: { margin: '4px 0 0', fontSize: '14px', color: '#64748b' },
  tabGroup: {
    display: 'flex',
    gap: '12px'
  },
  tabBtn: {
    padding: '10px 28px',
    fontSize: '15px',
    fontWeight: 'bold',
    borderRadius: '6px',
    border: '2px solid #cbd5e1',
    background: '#ffffff',
    color: '#334155',
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  },
  activeTabBtn: {
    background: '#1e293b',
    color: '#ffffff',
    borderColor: '#1e293b',
    boxShadow: '0 4px 10px rgba(30, 41, 59, 0.2)'
  },
  insightsContainer: {
    background: '#ffffff',
    borderRadius: '10px',
    border: '1px solid #e2e8f0',
    padding: '28px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.04)',
    minHeight: '420px'
  },
  insightsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #e2e8f0',
    paddingBottom: '16px',
    marginBottom: '24px'
  },
  gotoBtn: {
    padding: '8px 14px',
    background: '#f1f5f9',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontWeight: 'bold',
    fontSize: '13px',
    cursor: 'pointer'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '18px',
    marginBottom: '28px'
  },
  statCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '18px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  statLabel: { fontSize: '13px', fontWeight: 'bold', color: '#64748b' },
  statValue: { fontSize: '30px', fontWeight: '800', color: '#0f172a' },
  statSubtext: { fontSize: '12px', color: '#94a3b8' },
  progressSection: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '18px',
    marginBottom: '28px'
  },
  progressBarTrack: {
    width: '100%',
    height: '12px',
    background: '#e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden',
    display: 'flex'
  },
  legendRow: {
    display: 'flex',
    gap: '20px',
    marginTop: '10px',
    fontSize: '12px',
    color: '#475569',
    fontWeight: '600'
  },
  legendItem: { display: 'flex', alignItems: 'center', gap: '6px' },
  dot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
  tableHeading: { fontSize: '16px', color: '#1e293b', margin: '0 0 14px' },
  tableWrapper: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: {
    textAlign: 'left',
    padding: '12px',
    background: '#f1f5f9',
    color: '#475569',
    fontWeight: 'bold',
    borderBottom: '1px solid #cbd5e1'
  },
  tr: { borderBottom: '1px solid #e2e8f0' },
  td: { padding: '12px', color: '#334155', verticalAlign: 'middle' },
  scopeBulletList: {
    margin: '4px 0 0 0',
    paddingLeft: '16px',
    color: '#334155',
    fontSize: '12.5px',
    lineHeight: '1.5'
  },
  scopeBulletItem: {
    marginBottom: '3px'
  },
  badge: { padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  loadingState: { padding: '60px', textAlign: 'center', color: '#64748b', fontSize: '15px' },
  emptyText: { color: '#64748b', fontStyle: 'italic', fontSize: '14px' },
  errorBanner: {
    background: '#fee2e2',
    color: '#b91c1c',
    padding: '12px 16px',
    borderRadius: '6px',
    marginBottom: '20px',
    border: '1px solid #fca5a5',
    fontSize: '13px'
  }
};
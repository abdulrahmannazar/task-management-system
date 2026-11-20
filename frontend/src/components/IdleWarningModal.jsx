import React from 'react';

export default function IdleWarningModal({
  isOpen,
  remainingSeconds,
  stayingSignedIn,
  onStaySignedIn,
  onLogoutNow
}) {
  if (!isOpen) return null;

  return (
    <div style={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="idle-warning-title">
      <div style={styles.modal}>
        <div style={styles.iconWrapper}>
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#d97706"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>

        <h3 id="idle-warning-title" style={styles.title}>
          Session Expiring Soon
        </h3>

        <p style={styles.message}>
          You have been inactive for 29 minutes. For your security, you will be automatically logged out in{' '}
          <strong style={styles.countdown}>
            {remainingSeconds} {remainingSeconds === 1 ? 'second' : 'seconds'}
          </strong>
          .
        </p>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressBar,
              width: `${Math.min(100, Math.max(0, (remainingSeconds / 60) * 100))}%`
            }}
          />
        </div>

        <div style={styles.actions}>
          <button
            type="button"
            onClick={onLogoutNow}
            disabled={stayingSignedIn}
            style={styles.logoutBtn}
          >
            Log Out Now
          </button>
          <button
            type="button"
            onClick={onStaySignedIn}
            disabled={stayingSignedIn}
            style={styles.stayBtn}
          >
            {stayingSignedIn ? 'Extending Session...' : 'Stay Signed In'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.58)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999999,
    padding: '20px',
    fontFamily: "'Poppins', system-ui, -apple-system, sans-serif"
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.16), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
    maxWidth: '430px',
    width: '100%',
    padding: '28px 26px',
    textAlign: 'center'
  },
  iconWrapper: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px'
  },
  title: {
    margin: '0 0 10px',
    fontSize: '19px',
    fontWeight: '700',
    color: '#0f172a'
  },
  message: {
    margin: '0 0 18px',
    fontSize: '13.5px',
    lineHeight: '1.6',
    color: '#475569'
  },
  countdown: {
    color: '#d97706',
    fontWeight: '700',
    fontVariantNumeric: 'tabular-nums'
  },
  progressTrack: {
    width: '100%',
    height: '6px',
    backgroundColor: '#f4f6f8',
    borderRadius: '999px',
    overflow: 'hidden',
    marginBottom: '22px',
    border: '1px solid #e2e8f0'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#0284c7',
    transition: 'width 0.9s linear',
    borderRadius: '999px'
  },
  actions: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'center'
  },
  stayBtn: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#0284c7',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  logoutBtn: {
    flex: 1,
    padding: '10px 16px',
    backgroundColor: '#f4f6f8',
    color: '#0f172a',
    border: '1px solid #cbd5e1',
    borderRadius: '8px',
    fontSize: '13.5px',
    fontWeight: '600',
    cursor: 'pointer'
  }
};

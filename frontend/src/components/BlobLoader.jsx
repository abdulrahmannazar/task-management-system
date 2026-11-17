import React from 'react';

/**
 * Very Simple Non-AI Organic Blob Loader
 * Clean CSS morphing liquid blob in brand colors (#0284c7, #38bdf8, #0f172a).
 * Lightweight, 60fps GPU-accelerated, 100% geometric pure CSS.
 */
export default function BlobLoader({
  message = 'Loading...',
  size = 'medium',
  inline = false,
  minHeight = '180px'
}) {
  const pixelSize = typeof size === 'number'
    ? size
    : size === 'small' ? 24 : size === 'large' ? 68 : 46;

  const blobStyle = {
    width: `${pixelSize}px`,
    height: `${pixelSize}px`,
    background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 55%, #0ea5e9 100%)',
    boxShadow: '0 6px 20px -2px rgba(2, 132, 199, 0.38), inset 0 2px 4px rgba(255, 255, 255, 0.45)',
    animation: 'blobMorph 4s ease-in-out infinite alternate, blobPulse 2s ease-in-out infinite',
    transform: 'translateZ(0)',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  };

  const innerDotStyle = {
    width: `${Math.max(5, Math.floor(pixelSize * 0.22))}px`,
    height: `${Math.max(5, Math.floor(pixelSize * 0.22))}px`,
    borderRadius: '50%',
    background: '#ffffff',
    opacity: 0.85,
    boxShadow: '0 0 8px rgba(255, 255, 255, 0.75)'
  };

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <style>{keyframeStyles}</style>
        <span style={blobStyle}>
          <span style={innerDotStyle} />
        </span>
        {message && (
          <span style={{ fontSize: '13px', color: 'inherit', fontWeight: 500 }}>
            {message}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '30px 20px',
        minHeight: minHeight,
        gap: '12px',
        fontFamily: "'Poppins', system-ui, -apple-system, sans-serif"
      }}
    >
      <style>{keyframeStyles}</style>
      <div style={blobStyle}>
        <div style={innerDotStyle} />
      </div>
      {message && (
        <span
          style={{
            fontSize: '13px',
            color: '#64748b',
            fontWeight: 500,
            letterSpacing: '0.2px'
          }}
        >
          {message}
        </span>
      )}
    </div>
  );
}

const keyframeStyles = `
@keyframes blobMorph {
  0% {
    border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
    transform: rotate(0deg) scale(1);
  }
  33% {
    border-radius: 70% 30% 46% 54% / 30% 29% 71% 70%;
    transform: rotate(120deg) scale(1.05);
  }
  66% {
    border-radius: 35% 65% 58% 42% / 60% 65% 35% 40%;
    transform: rotate(240deg) scale(0.96);
  }
  100% {
    border-radius: 42% 58% 70% 30% / 45% 45% 55% 55%;
    transform: rotate(360deg) scale(1);
  }
}

@keyframes blobPulse {
  0%, 100% {
    box-shadow: 0 6px 18px -2px rgba(2, 132, 199, 0.35);
  }
  50% {
    box-shadow: 0 10px 26px 2px rgba(2, 132, 199, 0.52);
  }
}
`;

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
  minHeight = '180px',
  light = false
}) {
  const pixelSize = typeof size === 'number'
    ? size
    : size === 'button' || size === 'mini' ? 14
    : size === 'small' ? 18
    : size === 'large' ? 68 : 46;

  const blobBg = light
    ? 'linear-gradient(135deg, #ffffff 0%, #e0f2fe 55%, #bae6fd 100%)'
    : 'linear-gradient(135deg, #0284c7 0%, #38bdf8 55%, #0ea5e9 100%)';

  const blobShadow = light
    ? '0 2px 8px -1px rgba(255, 255, 255, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.8)'
    : '0 4px 14px -2px rgba(2, 132, 199, 0.38), inset 0 2px 4px rgba(255, 255, 255, 0.45)';

  const dotBg = light ? '#0284c7' : '#ffffff';

  const blobStyle = {
    width: `${pixelSize}px`,
    height: `${pixelSize}px`,
    background: blobBg,
    boxShadow: blobShadow,
    animation: 'blobMorph 4s ease-in-out infinite alternate, blobPulse 2s ease-in-out infinite',
    transform: 'translateZ(0)',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  };

  const innerDotStyle = {
    width: `${Math.max(3, Math.floor(pixelSize * 0.24))}px`,
    height: `${Math.max(3, Math.floor(pixelSize * 0.24))}px`,
    borderRadius: '50%',
    background: dotBg,
    opacity: 0.9,
    boxShadow: light ? 'none' : '0 0 6px rgba(255, 255, 255, 0.75)'
  };

  if (inline) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', verticalAlign: 'middle' }}>
        <style>{keyframeStyles}</style>
        <span style={blobStyle}>
          <span style={innerDotStyle} />
        </span>
        {message && (
          <span style={{ fontSize: 'inherit', color: 'inherit', fontWeight: 'inherit', letterSpacing: 'inherit' }}>
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

export function ButtonLoader({ message = 'Saving...', size = 14, light = true }) {
  return <BlobLoader inline size={size} light={light} message={message} />;
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

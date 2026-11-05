import React from 'react';

export default function FrontierLogo({ size = 44, iconOnly = false, className = '', style = {} }) {
  if (iconOnly) {
    return (
      <img
        src="/logo-icon.png"
        alt="Frontier Advisory"
        className={className}
        style={{
          width: typeof size === 'number' ? `${size}px` : size,
          height: typeof size === 'number' ? `${size}px` : size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          ...style
        }}
      />
    );
  }

  return (
    <img
      src="/logo-full.png"
      alt="Frontier Advisory Task Management"
      className={className}
      style={{
        width: typeof size === 'number' ? `${size}px` : size,
        height: 'auto',
        maxHeight: '130px',
        objectFit: 'contain',
        display: 'block',
        ...style
      }}
    />
  );
}

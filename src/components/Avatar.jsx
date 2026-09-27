import React, { useState } from 'react';

/**
 * Universal Blank Person Avatar component.
 * Renders a clean, blank person silhouette by default.
 * If a custom image source (uploaded photo / custom URL, excluding AI emoji/dicebear generators)
 * is provided and loads successfully, it renders the image.
 */
export const BlankPersonIcon = ({ size, className = '' }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={`blank-avatar-svg ${className}`}
    style={size ? { width: size, height: size } : undefined}
    aria-hidden="true"
  >
    <path d="M12 12c2.485 0 4.5-2.015 4.5-4.5S14.485 3 12 3 7.5 5.015 7.5 7.5 9.515 12 12 12zm0 2.25c-3.007 0-9 1.512-9 4.5v1.75c0 .414.336.75.75.75h16.5c.414 0 .75-.336.75-.75v-1.75c0-2.988-5.993-4.5-9-4.5z" />
  </svg>
);

export const Avatar = ({ 
  src, 
  name,
  alt, 
  size = 32, 
  iconSize,
  className = "", 
  style = {},
  children
}) => {
  const [imgError, setImgError] = useState(false);
  const displayName = alt || name || "User Avatar";
  const numSize = typeof size === 'number' ? `${size}px` : (size || '32px');

  // Automatically filter out automated AI/cartoon emoji generators (DiceBear avataaars, etc.)
  const isCustomRealImage = src && 
    typeof src === 'string' &&
    !src.includes('dicebear.com') && 
    !src.includes('avataaars') && 
    !imgError;

  const containerStyle = {
    width: numSize,
    height: numSize,
    minWidth: numSize,
    minHeight: numSize,
    maxWidth: numSize,
    maxHeight: numSize,
    borderRadius: '50%',
    flexShrink: 0,
    ...style
  };

  if (isCustomRealImage) {
    return (
      <div className={`avatar-container ${className}`} style={containerStyle}>
        <img 
          src={src} 
          alt={displayName} 
          className="avatar-img"
          onError={() => setImgError(true)} 
        />
        {children}
      </div>
    );
  }

  return (
    <div 
      className={`blank-person-avatar ${className}`} 
      style={containerStyle}
      title={displayName}
      aria-label={displayName}
    >
      <BlankPersonIcon size={iconSize} />
      {children}
    </div>
  );
};

export default Avatar;

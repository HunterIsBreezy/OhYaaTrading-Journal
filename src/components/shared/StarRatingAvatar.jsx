import { useState } from 'react';

// =============================================================================
// STAR RATING
// =============================================================================
export function StarRating({ value, onChange, readonly = false, size = 'md' }) {
  const [hoverValue, setHoverValue] = useState(0);

  const sizeClasses = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-8 h-8' };
  const starSize = sizeClasses[size] || sizeClasses.md;

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= (hoverValue || value);
        return (
          <button
            key={star}
            type="button"
            onClick={() => !readonly && onChange(star === value ? 0 : star)}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            onMouseLeave={() => !readonly && setHoverValue(0)}
            disabled={readonly}
            className={`${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition-transform ${isFilled ? 'text-amber-400' : 'text-gray-300'}`}
          >
            <svg viewBox="0 0 24 24" fill={isFilled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={starSize}>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// AVATAR
// =============================================================================
export function Avatar({ user, size = 'md', className = '' }) {
  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-2xl',
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const initial =
    user?.displayName?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    '?';
  const photoURL = user?.photoURL;

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={user?.displayName || 'User'}
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`${sizeClass} bg-blue-100 rounded-full flex items-center justify-center font-bold text-blue-600 ${className}`}>
      {initial}
    </div>
  );
}

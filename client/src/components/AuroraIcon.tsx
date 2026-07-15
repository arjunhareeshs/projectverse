import React from 'react';
import { cn } from '../utils/cn';

interface AuroraIconProps {
  /** Diameter of the circle in px. */
  size?: number;
  /** Revolution duration, e.g. "5s". */
  spin?: string;
  /** Glow strength 0.4 – 1. */
  intensity?: number;
  className?: string;
}

/**
 * Animated "aurora" sparkle badge — a spinning conic glow behind a 4-point star.
 * Purely decorative; wrap it in a <button> to make it interactive.
 */
export const AuroraIcon: React.FC<AuroraIconProps> = ({
  size = 44,
  spin = '5s',
  intensity = 0.85,
  className,
}) => {
  const style = {
    '--aurora-size': `${size}px`,
    '--aurora-spin': spin,
    '--aurora-intensity': intensity,
  } as React.CSSProperties;

  return (
    <span className={cn('aurora-icon', className)} style={style} aria-hidden="true">
      <span className="aurora-icon__bloom" />
      <span className="aurora-icon__beam" />
      <span className="aurora-icon__veil" />
      <span className="aurora-icon__center">
        <svg width="100%" height="100%" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3 C12.6 7.8 16.2 11.4 21 12 C16.2 12.6 12.6 16.2 12 21 C11.4 16.2 7.8 12.6 3 12 C7.8 11.4 11.4 7.8 12 3 Z"
            fill="currentColor"
            opacity="0.9"
          />
        </svg>
      </span>
    </span>
  );
};

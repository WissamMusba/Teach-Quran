import React from 'react';

/**
 * Custom cricket glyphs drawn to match the Lucide stroke language
 * (24x24 grid, 2px stroke, round caps/joins) so they blend with the
 * rest of the icon set. Lucide ships no cricket bat / ball icons.
 */

export interface CricketIconProps {
  className?: string;
  strokeWidth?: number;
}

export const CricketBatIcon: React.FC<CricketIconProps> = ({ className = 'w-4 h-4', strokeWidth = 2 }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Handle */}
    <path d="M17.4 5.8 L12.4 10.8" />
    {/* Blade (rotated rounded rectangle) */}
    <rect x="4.6" y="9.2" width="6.8" height="12" rx="3.4" transform="rotate(45 8 15.2)" />
  </svg>
);

export const CricketBallIcon: React.FC<CricketIconProps> = ({ className = 'w-4 h-4', strokeWidth = 2 }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    {/* Ball body */}
    <circle cx="12" cy="12" r="8.5" />
    {/* Stitched seam rows */}
    <path d="M8.6 4.7 a10 10 0 0 0 0 14.6" />
    <path d="M15.4 4.7 a10 10 0 0 1 0 14.6" />
  </svg>
);

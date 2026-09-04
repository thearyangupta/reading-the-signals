import React from 'react';

interface SignalMarkProps {
  className?: string;
}

/**
 * Reading the Signals' small proprietary brand motif: a source point with
 * two detection rings. Deliberately kept small and restrained — it is not
 * expanded into a larger illustrative visualization. Shared between the
 * Navbar brand mark and Auth's editorial kicker so the identity reads as
 * one consistent mark rather than a one-off icon.
 */
export const SignalMark: React.FC<SignalMarkProps> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className ?? 'h-5 w-5 [overflow:visible]'} fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1" opacity="0.28" className="signal-pulse-ring" />
    <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.25" opacity="0.55" />
    <circle cx="12" cy="12" r="2.25" fill="currentColor" />
  </svg>
);

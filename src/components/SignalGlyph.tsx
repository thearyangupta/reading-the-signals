import React from 'react';

/**
 * Small static dot-and-ring glyph — the same brand motif as SignalMark, at
 * label scale, with no animation. Used as the consistent "this is
 * AI-generated" marker (AI-Native UI vocabulary) across Journal, Entry
 * Detail, and the reflection dialogue, so AI content is identifiable at a
 * glance without competing with the user's own writing.
 */
export const SignalGlyph: React.FC = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
    <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    <circle cx="8" cy="8" r="1.75" fill="currentColor" />
  </svg>
);

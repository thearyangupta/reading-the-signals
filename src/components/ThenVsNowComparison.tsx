import React from 'react';
import {
  JournalEntry,
  SignalTimelineResult,
  TimelineShiftType,
} from '../types';
import {
  Calendar,
  Clock,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface ThenVsNowComparisonProps {
  targetEntries: JournalEntry[];
  timelineResult: SignalTimelineResult | null;
  loadingTimeline: boolean;
  onAnalyzeTimeline: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

const SHIFT_TYPE_LABELS: Record<TimelineShiftType, string> = {
  perspective: 'Change in perspective',
  emotional_reaction: 'Change in emotional reaction',
  interpretation: 'Change in interpretation',
  focus: 'Change in focus',
};

export const ThenVsNowComparison: React.FC<ThenVsNowComparisonProps> = ({
  targetEntries,
  timelineResult,
  loadingTimeline,
  onAnalyzeTimeline,
  onSelectEntry,
}) => {
  // Evidence Resolution: Strictly resolve entryId against targetEntries only. Never fall back to global entries.
  const handleEvidenceClick = (entryId: string) => {
    const match = targetEntries.find((e) => e.id === entryId);
    if (match) {
      onSelectEntry(match);
    }
  };

  // Guard A: Fewer than 2 structured reflections in active scope
  if (targetEntries.length < 2) {
    return (
      <section id="then-vs-now-insufficient-scope" className="space-y-2 border-t border-journal-border py-6">
        <h4 className="font-serif text-base font-semibold text-journal-ink">Add another reflection to compare</h4>
        <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
          Then vs Now needs at least two reflections in the current scope so an earlier and a later moment can be compared.
        </p>
        <p className="text-xs text-journal-ink-faint">
          Current scope: {targetEntries.length} {targetEntries.length === 1 ? 'reflection' : 'reflections'}.
        </p>
      </section>
    );
  }

  const hasResult = timelineResult !== null;

  return (
    <div id="then-vs-now-container" className="space-y-6">
      {/* Purpose + primary action */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
          Compare earlier and later reflections without assuming that one is better, worse, or more final than the other.
        </p>
        <button
          id="then-vs-now-analyze-btn"
          type="button"
          onClick={onAnalyzeTimeline}
          disabled={loadingTimeline}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:bg-journal-panel-2 disabled:text-journal-ink-faint disabled:shadow-none sm:w-auto"
        >
          {loadingTimeline ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Comparing…</span>
            </>
          ) : hasResult ? (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Refresh comparison</span>
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>Create comparison</span>
            </>
          )}
        </button>
      </div>

      {/* AI provenance */}
      <div className="flex items-start gap-3 rounded-card border border-journal-border bg-journal-panel px-4 py-3 text-sm text-journal-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-journal-accent-bright" aria-hidden="true" />
        <p className="leading-relaxed">
          This comparison is generated only from reflections in the current scope. Earlier and later are AI-identified interpretations, not proof of change — later does not mean better, worse, or more resolved, chronology alone does not establish causation, and results are not diagnoses, hidden motives, or fixed identity claims.
        </p>
      </div>

      {/* Loading */}
      {loadingTimeline && (
        <div id="then-vs-now-loading-state" role="status" aria-live="polite" className="space-y-3 py-12 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-journal-accent-bright" aria-hidden="true" />
          <p className="font-serif text-base font-semibold text-journal-ink">Comparing these reflections…</p>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
            AI is looking at earlier and later reflections in this scope to describe what may differ.
          </p>
        </div>
      )}

      {/* Guard B: not yet generated */}
      {!loadingTimeline && timelineResult === null && (
        <div id="then-vs-now-initial-prompt" className="space-y-2 border-t border-journal-border py-8 text-center">
          <Clock className="mx-auto h-6 w-6 text-journal-ink-faint" aria-hidden="true" />
          <h4 className="font-serif text-base font-semibold text-journal-ink">No comparison yet</h4>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
            Create a comparison when you are ready to see earlier and later reflections from this scope side by side.
          </p>
        </div>
      )}

      {/* Guard C: insufficient evidence */}
      {!loadingTimeline && timelineResult !== null && !timelineResult.hasSufficientEvidence && (
        <div id="then-vs-now-insufficient-evidence" className="space-y-2 border-t border-journal-border py-8 text-center">
          <Info className="mx-auto h-6 w-6 text-journal-ink-faint" aria-hidden="true" />
          <h4 className="font-serif text-base font-semibold text-journal-ink">No clear comparison surfaced</h4>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
            {timelineResult.message || 'The reflections in this scope may not contain enough grounded contrast for a useful comparison. This does not mean nothing changed.'}
          </p>
        </div>
      )}

      {/* Guard D: no shifts identified */}
      {!loadingTimeline && timelineResult !== null && timelineResult.hasSufficientEvidence && (!timelineResult.shifts || timelineResult.shifts.length === 0) && (
        <div id="then-vs-now-no-shifts" className="space-y-2 border-t border-journal-border py-8 text-center">
          <Info className="mx-auto h-6 w-6 text-journal-ink-faint" aria-hidden="true" />
          <h4 className="font-serif text-base font-semibold text-journal-ink">No clear comparison surfaced</h4>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
            The reflections in this scope did not surface a clear earlier/later contrast. This does not mean nothing changed — it means the AI did not find enough grounded evidence to describe one.
          </p>
        </div>
      )}

      {/* Populated comparison */}
      {!loadingTimeline && timelineResult !== null && timelineResult.hasSufficientEvidence && timelineResult.shifts && timelineResult.shifts.length > 0 && (
        <section aria-labelledby="then-now-results-title" className="space-y-5 border-t border-journal-border pt-5">
          <h4 id="then-now-results-title" className="text-sm font-semibold text-journal-ink-muted">
            {timelineResult.shifts.length} {timelineResult.shifts.length === 1 ? 'comparison' : 'comparisons'}
          </h4>

          <div className="space-y-5">
            {timelineResult.shifts.map((shift, idx) => {
              const earlierEvidence = (shift.supportingEntries || []).filter(
                (se) => se.roleInShift === 'earlier_state'
              );
              const laterEvidence = (shift.supportingEntries || []).filter(
                (se) => se.roleInShift === 'later_state'
              );
              const contextEvidence = (shift.supportingEntries || []).filter(
                (se) => se.roleInShift === 'context'
              );

              // Check if explanation is distinct from observation
              const hasDistinctExplanation = Boolean(
                shift.explanation &&
                shift.explanation.trim().toLowerCase() !== shift.observation.trim().toLowerCase()
              );

              const shiftTypeLabel = SHIFT_TYPE_LABELS[shift.shiftType] || 'Recorded change';

              return (
                <article
                  key={idx}
                  aria-label={`Comparison ${idx + 1} of ${timelineResult.shifts.length}`}
                  className="min-w-0 space-y-5 rounded-card border border-journal-border bg-journal-panel p-4 shadow-low sm:p-6"
                >
                  {/* Date context */}
                  {shift.earlierDate && shift.laterDate && (
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-journal-ink-faint">
                      <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="[overflow-wrap:anywhere]">{shift.earlierDate}</span>
                      <span aria-hidden="true">·</span>
                      <span className="[overflow-wrap:anywhere]">{shift.laterDate}</span>
                    </div>
                  )}

                  {/* Earlier / Later, equal weight */}
                  <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-2 md:divide-x md:divide-journal-border">
                    <section aria-label="Earlier reflections" className="min-w-0 space-y-3 md:pr-6">
                      <div className="space-y-0.5">
                        <h6 className="text-sm font-semibold text-journal-ink-muted">Earlier reflections</h6>
                        {shift.earlierDate && (
                          <p className="text-xs text-journal-ink-faint">{shift.earlierDate}</p>
                        )}
                      </div>
                      <p className="font-serif text-base leading-relaxed text-journal-ink">{shift.earlierState}</p>
                      {earlierEvidence.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-journal-ink-faint">Source reflections</p>
                          <div className="flex min-w-0 flex-col gap-2">
                            {earlierEvidence.map((se, sIdx) => {
                              const isResolvable = targetEntries.some((e) => e.id === se.entryId);
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleEvidenceClick(se.entryId)}
                                  disabled={!isResolvable}
                                  className="flex min-h-11 w-full min-w-0 max-w-full flex-col items-start gap-0.5 rounded-control border border-journal-border bg-journal-panel-2 px-3 py-2 text-left transition-colors hover:border-journal-accent hover:bg-journal-panel disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-journal-border disabled:hover:bg-journal-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                >
                                  <span className="flex min-w-0 max-w-full items-center gap-2 text-sm font-semibold text-journal-ink">
                                    <FileText className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{se.title}</span>
                                  </span>
                                  {se.date && <span className="pl-6 text-xs text-journal-ink-faint">{se.date}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>

                    <section aria-label="Later reflections" className="min-w-0 space-y-3 md:pl-6">
                      <div className="space-y-0.5">
                        <h6 className="text-sm font-semibold text-journal-ink-muted">Later reflections</h6>
                        {shift.laterDate && (
                          <p className="text-xs text-journal-ink-faint">{shift.laterDate}</p>
                        )}
                      </div>
                      <p className="font-serif text-base leading-relaxed text-journal-ink">{shift.laterState}</p>
                      {laterEvidence.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-journal-ink-faint">Source reflections</p>
                          <div className="flex min-w-0 flex-col gap-2">
                            {laterEvidence.map((se, sIdx) => {
                              const isResolvable = targetEntries.some((e) => e.id === se.entryId);
                              return (
                                <button
                                  key={sIdx}
                                  type="button"
                                  onClick={() => handleEvidenceClick(se.entryId)}
                                  disabled={!isResolvable}
                                  className="flex min-h-11 w-full min-w-0 max-w-full flex-col items-start gap-0.5 rounded-control border border-journal-border bg-journal-panel-2 px-3 py-2 text-left transition-colors hover:border-journal-accent hover:bg-journal-panel disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-journal-border disabled:hover:bg-journal-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                                >
                                  <span className="flex min-w-0 max-w-full items-center gap-2 text-sm font-semibold text-journal-ink">
                                    <FileText className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{se.title}</span>
                                  </span>
                                  {se.date && <span className="pl-6 text-xs text-journal-ink-faint">{se.date}</span>}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </section>
                  </div>

                  {/* What may differ */}
                  <div className="space-y-3 border-t border-journal-border pt-4">
                    <div className="space-y-0.5">
                      <h6 className="text-sm font-semibold text-journal-ink-muted">What may differ</h6>
                      <p className="text-xs text-journal-ink-faint">An AI-drawn observation, not proof of change.</p>
                    </div>
                    <p className="font-serif text-lg leading-relaxed text-journal-ink">{shift.observation}</p>
                    {hasDistinctExplanation && (
                      <div className="space-y-1 pt-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-journal-ink-faint">From the recorded reflections</p>
                        <p className="text-sm leading-relaxed text-journal-ink-muted">{shift.explanation}</p>
                      </div>
                    )}
                  </div>

                  {/* Additional context */}
                  {contextEvidence.length > 0 && (
                    <div className="space-y-2 border-t border-journal-border pt-4">
                      <h6 className="text-sm font-semibold text-journal-ink-muted">Additional context</h6>
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {contextEvidence.map((se, sIdx) => {
                          const isResolvable = targetEntries.some((e) => e.id === se.entryId);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleEvidenceClick(se.entryId)}
                              disabled={!isResolvable}
                              className="flex min-h-11 w-full min-w-0 max-w-full flex-1 flex-col items-start gap-0.5 rounded-control border border-journal-border bg-journal-panel-2 px-3 py-2 text-left transition-colors hover:border-journal-accent hover:bg-journal-panel disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-journal-border disabled:hover:bg-journal-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
                            >
                              <span className="flex min-w-0 max-w-full items-center gap-2 text-sm font-semibold text-journal-ink">
                                <FileText className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                <span className="min-w-0 [overflow-wrap:anywhere]">{se.title}</span>
                              </span>
                              {se.date && <span className="pl-6 text-xs text-journal-ink-faint">{se.date}</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quiet shift-type / support metadata */}
                  <p className="border-t border-journal-border pt-3 text-xs text-journal-ink-faint">
                    {shiftTypeLabel} · {shift.evidenceCount} supporting {shift.evidenceCount === 1 ? 'reflection' : 'reflections'}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};

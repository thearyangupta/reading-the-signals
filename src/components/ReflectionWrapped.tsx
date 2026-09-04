import React from 'react';
import {
  JournalEntry,
  CrossEntryAnalysisResult,
  SignalTimelineResult,
  TimelineShiftType,
} from '../types';
import {
  Calendar,
  FileText,
  Info,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface ReflectionWrappedProps {
  targetEntries: JournalEntry[];
  patternsResult: CrossEntryAnalysisResult | null;
  timelineResult: SignalTimelineResult | null;
  loadingPatterns: boolean;
  loadingTimeline: boolean;
  onAnalyzePatterns: () => void;
  onAnalyzeTimeline: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

const SHIFT_TYPE_LABELS: Record<TimelineShiftType, string> = {
  perspective: 'change in perspective',
  emotional_reaction: 'change in emotional reaction',
  interpretation: 'change in interpretation',
  focus: 'change in focus',
};

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    return new Date(year, month - 1, day).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

export const ReflectionWrapped: React.FC<ReflectionWrappedProps> = ({
  targetEntries,
  patternsResult,
  timelineResult,
  loadingPatterns,
  loadingTimeline,
  onAnalyzePatterns,
  onAnalyzeTimeline,
  onSelectEntry,
}) => {
  // Sort target entries chronologically for a deterministic reflection order
  const chronologicalEntries = [...targetEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleOpenEntryById = (entryId: string) => {
    const found = targetEntries.find((e) => e.id === entryId);
    if (found) {
      onSelectEntry(found);
    }
  };

  // Guard: Fewer than 2 structured reflections in active scope
  if (targetEntries.length < 2) {
    return (
      <section id="reflection-wrapped-insufficient-scope" className="space-y-2 border-t border-journal-border py-6">
        <h4 className="font-serif text-base font-semibold text-journal-ink">Add another reflection to see a recap</h4>
        <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
          Reflection Wrapped needs at least two reflections in the current scope to summarize patterns and shifts.
        </p>
        <p className="text-xs text-journal-ink-faint">
          Current scope: {targetEntries.length} {targetEntries.length === 1 ? 'reflection' : 'reflections'}.
        </p>
      </section>
    );
  }

  const hasPatterns = Boolean(patternsResult && patternsResult.hasSufficientEvidence && patternsResult.patterns?.length > 0);
  const hasTimeline = Boolean(timelineResult && timelineResult.hasSufficientEvidence && timelineResult.shifts?.length > 0);

  // Emotional/perspective shifts drawn from the shared Timeline result
  const emotionalShifts = (timelineResult?.shifts || []).filter(
    (s) => s.shiftType === 'emotional_reaction' || s.shiftType === 'perspective'
  );

  const firstEntry = chronologicalEntries[0];
  const lastEntry = chronologicalEntries[chronologicalEntries.length - 1];

  return (
    <div id="reflection-wrapped-container" className="space-y-8">
      {/* Purpose */}
      <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
        Review the signals, reactions, and shifts that appeared across your current reflection scope.
      </p>

      {/* Quiet deterministic scope snapshot */}
      <p className="text-xs text-journal-ink-faint">
        {chronologicalEntries.length} {chronologicalEntries.length === 1 ? 'reflection' : 'reflections'} · {formatDate(firstEntry.date)} – {formatDate(lastEntry.date)}
      </p>

      {/* AI provenance */}
      <div className="flex items-start gap-3 rounded-card border border-journal-border bg-journal-panel px-4 py-3 text-sm text-journal-ink-muted">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-journal-accent-bright" aria-hidden="true" />
        <p className="leading-relaxed">
          This recap summarizes only the reflections in your current scope. Patterns and perspective-shift observations below come from AI analysis; the reaction overview uses summaries already stored with each reflection. None of this is an objective fact, a diagnosis, a claim about hidden motives, or a fixed identity — and the order reflections appear in does not prove causation or personal progress.
        </p>
      </div>

      {/* Emotional & reaction overview */}
      <div className="space-y-4 border-t border-journal-border pt-6">
        <div className="space-y-1">
          <h4 className="font-serif text-lg font-semibold text-journal-ink">Emotional &amp; reaction overview</h4>
          <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
            A chronological view of the reactions already captured in your saved reflection summaries.
          </p>
        </div>

        <div className="space-y-3">
          {chronologicalEntries.map((entry) => (
            <article key={entry.id} className="min-w-0 space-y-2 rounded-card border border-journal-border bg-journal-panel p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h5 className="min-w-0 [overflow-wrap:anywhere] font-serif text-base font-semibold text-journal-ink">
                  {entry.title}
                </h5>
                <span className="shrink-0 text-xs text-journal-ink-faint">{formatDate(entry.date)}</span>
              </div>
              {entry.summary?.emotionalTone && (
                <p className="text-sm text-journal-ink-muted">
                  <span className="font-semibold text-journal-ink">Tone: </span>
                  {entry.summary.emotionalTone}
                </p>
              )}
              {entry.summary?.feelingOrReaction && (
                <p className="text-sm leading-relaxed text-journal-ink-muted">{entry.summary.feelingOrReaction}</p>
              )}
              <button
                type="button"
                onClick={() => onSelectEntry(entry)}
                className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-journal-accent-bright transition-colors hover:bg-journal-panel-2 hover:text-journal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              >
                <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>View reflection</span>
              </button>
            </article>
          ))}
        </div>

        {emotionalShifts.length > 0 && (
          <div className="space-y-3 border-t border-journal-border pt-4">
            <h5 className="font-serif text-base font-semibold text-journal-ink">Related perspective or reaction shifts</h5>
            <div className="space-y-3">
              {emotionalShifts.map((shift, sIdx) => (
                <article key={sIdx} className="min-w-0 space-y-3 rounded-card border border-journal-border bg-journal-panel p-4">
                  <p className="text-sm leading-relaxed text-journal-ink">{shift.observation}</p>
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-journal-border">
                    <div className="min-w-0 space-y-1 sm:pr-4">
                      <p className="text-xs font-semibold text-journal-ink-faint">
                        Earlier reflection{shift.earlierDate ? ` · ${shift.earlierDate}` : ''}
                      </p>
                      <p className="font-serif text-sm leading-relaxed text-journal-ink">{shift.earlierState}</p>
                    </div>
                    <div className="min-w-0 space-y-1 sm:pl-4">
                      <p className="text-xs font-semibold text-journal-ink-faint">
                        Later reflection{shift.laterDate ? ` · ${shift.laterDate}` : ''}
                      </p>
                      <p className="font-serif text-sm leading-relaxed text-journal-ink">{shift.laterState}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Patterns that appeared */}
      <div className="space-y-4 border-t border-journal-border pt-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h4 className="font-serif text-lg font-semibold text-journal-ink">Patterns that appeared</h4>
            <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
              Recurring signals or reaction loops observed across multiple reflections in this scope.
            </p>
          </div>
          <button
            type="button"
            onClick={onAnalyzePatterns}
            disabled={loadingPatterns}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:bg-journal-panel-2 disabled:text-journal-ink-faint disabled:shadow-none sm:w-auto"
          >
            {loadingPatterns ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Finding patterns…</span>
              </>
            ) : patternsResult !== null ? (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Refresh patterns</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Find patterns</span>
              </>
            )}
          </button>
        </div>

        {loadingPatterns ? (
          <div role="status" aria-live="polite" className="space-y-3 py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-journal-accent-bright" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-journal-ink-muted">Finding patterns…</p>
          </div>
        ) : patternsResult === null ? (
          <div className="space-y-1 py-6 text-center">
            <h5 className="font-serif text-base font-semibold text-journal-ink">No patterns yet</h5>
            <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
              Find patterns when you are ready to look for recurring signals across this scope.
            </p>
          </div>
        ) : !hasPatterns ? (
          <div className="space-y-1 py-6 text-center">
            <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
              No clear recurring patterns have been surfaced for this scope yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {patternsResult!.patterns.map((pattern, pIdx) => (
              <article key={pIdx} className="min-w-0 space-y-3 rounded-card border border-journal-border bg-journal-panel p-4 sm:p-5">
                <div className="space-y-2">
                  <h5 className="font-serif text-base font-semibold leading-snug text-journal-ink">
                    {pattern.observation}
                  </h5>
                  {pattern.explanation && (
                    <p className="text-sm leading-relaxed text-journal-ink-muted">{pattern.explanation}</p>
                  )}
                </div>

                {Array.isArray(pattern.supportingEntries) && pattern.supportingEntries.length > 0 && (
                  <div className="space-y-2 border-t border-journal-border pt-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-journal-ink">
                      <FileText className="h-4 w-4 text-user-accent" aria-hidden="true" />
                      <span>Supporting reflections</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {pattern.supportingEntries.map((se, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleOpenEntryById(se.entryId)}
                          className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-control border border-journal-border bg-journal-panel-2 px-3 py-2 text-left text-sm text-journal-ink transition-colors hover:border-journal-accent hover:bg-journal-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
                          title={`Open reflection: ${se.title}`}
                        >
                          <Calendar className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                          <span className="min-w-0 flex-1 [overflow-wrap:anywhere] font-medium">{se.title}</span>
                          {se.date && <span className="shrink-0 text-xs text-journal-ink-faint">{se.date}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="border-t border-journal-border pt-3 text-xs text-journal-ink-faint">
                  {pattern.evidenceCount} supporting {pattern.evidenceCount === 1 ? 'reflection' : 'reflections'}
                  {pattern.evidenceStrength ? ` · ${pattern.evidenceStrength} support` : ''}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Perspective shifts noticed */}
      <div className="space-y-4 border-t border-journal-border pt-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <h4 className="font-serif text-lg font-semibold text-journal-ink">Perspective shifts noticed</h4>
            <p className="max-w-reading text-sm leading-relaxed text-journal-ink-muted">
              Documented shifts in perspective, interpretation, or focus across the reflections in this scope.
            </p>
          </div>
          <button
            type="button"
            onClick={onAnalyzeTimeline}
            disabled={loadingTimeline}
            className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:bg-journal-panel-2 disabled:text-journal-ink-faint disabled:shadow-none sm:w-auto"
          >
            {loadingTimeline ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Finding shifts…</span>
              </>
            ) : timelineResult !== null ? (
              <>
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Refresh shifts</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                <span>Find perspective shifts</span>
              </>
            )}
          </button>
        </div>

        {loadingTimeline ? (
          <div role="status" aria-live="polite" className="space-y-3 py-10 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-journal-accent-bright" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-journal-ink-muted">Finding shifts…</p>
          </div>
        ) : timelineResult === null ? (
          <div className="space-y-1 py-6 text-center">
            <h5 className="font-serif text-base font-semibold text-journal-ink">No perspective shifts yet</h5>
            <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
              Find perspective shifts when you are ready to look for change across this scope.
            </p>
          </div>
        ) : !hasTimeline ? (
          <div className="space-y-1 py-6 text-center">
            <p className="mx-auto max-w-reading text-sm leading-relaxed text-journal-ink-muted">
              No clear perspective shifts have been surfaced for this scope yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {timelineResult!.shifts.map((shift, idx) => (
              <article key={idx} className="min-w-0 space-y-4 rounded-card border border-journal-border bg-journal-panel p-4 sm:p-5">
                <div className="space-y-2">
                  <h5 className="font-serif text-base font-semibold leading-snug text-journal-ink">
                    {shift.observation}
                  </h5>
                  {shift.explanation && (
                    <p className="text-sm leading-relaxed text-journal-ink-muted">{shift.explanation}</p>
                  )}
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:divide-x sm:divide-journal-border">
                  <div className="min-w-0 space-y-1 sm:pr-4">
                    <p className="text-xs font-semibold text-journal-ink-faint">
                      Earlier reflection{shift.earlierDate ? ` · ${shift.earlierDate}` : ''}
                    </p>
                    <p className="font-serif text-sm leading-relaxed text-journal-ink">{shift.earlierState}</p>
                  </div>
                  <div className="min-w-0 space-y-1 sm:pl-4">
                    <p className="text-xs font-semibold text-journal-ink-faint">
                      Later reflection{shift.laterDate ? ` · ${shift.laterDate}` : ''}
                    </p>
                    <p className="font-serif text-sm leading-relaxed text-journal-ink">{shift.laterState}</p>
                  </div>
                </div>

                {Array.isArray(shift.supportingEntries) && shift.supportingEntries.length > 0 && (
                  <div className="space-y-2 border-t border-journal-border pt-3">
                    <p className="flex items-center gap-2 text-sm font-semibold text-journal-ink">
                      <FileText className="h-4 w-4 text-user-accent" aria-hidden="true" />
                      <span>Supporting reflections</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {shift.supportingEntries.map((se, sIdx) => (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleOpenEntryById(se.entryId)}
                          className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-control border border-journal-border bg-journal-panel-2 px-3 py-2 text-left text-sm text-journal-ink transition-colors hover:border-journal-accent hover:bg-journal-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
                          title={`Open reflection: ${se.title}`}
                        >
                          <Calendar className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                          <span className="min-w-0 flex-1 [overflow-wrap:anywhere] font-medium">{se.title}</span>
                          {se.date && <span className="shrink-0 text-xs text-journal-ink-faint">{se.date}</span>}
                          {se.roleInShift && (
                            <span className="shrink-0 text-xs text-journal-ink-faint">
                              ({se.roleInShift === 'earlier_state' ? 'earlier' : se.roleInShift === 'later_state' ? 'later' : 'context'})
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <p className="border-t border-journal-border pt-3 text-xs text-journal-ink-faint">
                  {SHIFT_TYPE_LABELS[shift.shiftType] || 'recorded change'} · {shift.evidenceCount} supporting {shift.evidenceCount === 1 ? 'reflection' : 'reflections'}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Closing grounding note */}
      <p className="border-t border-journal-border pt-6 text-sm italic leading-relaxed text-journal-ink-faint">
        These observations are prompts for reflection, not conclusions about you.
      </p>
    </div>
  );
};

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Download,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import { importSampleEntries, subscribeUserRememberedSignals } from '../lib/firebase';
import { selectNextMove } from '../lib/signals';
import { JournalEntry, RememberedSignal } from '../types';
import { NextMoveCard } from './NextMoveCard';
import { SignalGlyph } from './SignalGlyph';
import { SignalMark } from './SignalMark';

interface JournalListProps {
  entries: JournalEntry[];
  loading: boolean;
  userId?: string;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

const formatEntryDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);

  if (!year || !month || !day) return date;

  const localDate = new Date(year, month - 1, day);
  if (Number.isNaN(localDate.getTime())) return date;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(localDate);
};

/** Deterministic small hash of an entry id — used only to pick a stable,
 * repeatable visual-surface layout variant per reflection (not randomness
 * re-rolled on every render). */
const hashId = (id: string): number => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};

interface VisualVariant {
  titleLeft: number;
  titleTop: number;
  titleRotate: number;
  traceLeft: number;
  descTop: number;
  bendTop: number;
  stepWidth: number;
}

/** All top/left values are percentages of the card's SAFE AREA (the inset
 * box below), not the raw card box — this keeps every deterministic
 * variant clear of the edges by construction. titleTop/titleLeft sit the
 * title fragment inward in the upper-middle band; the trace then begins
 * below the title (descTop), steps down to a lower-middle bend (bendTop)
 * and travels stepWidth further right, where the violet resolution
 * segment and SignalMark pick up — deliberately separated from the
 * title, never touching it. */
const VISUAL_VARIANTS: VisualVariant[] = [
  { titleLeft: 14, titleTop: 38, titleRotate: -1, traceLeft: 18, descTop: 54, bendTop: 66, stepWidth: 26 },
  { titleLeft: 18, titleTop: 44, titleRotate: 0.7, traceLeft: 24, descTop: 60, bendTop: 72, stepWidth: 30 },
  { titleLeft: 16, titleTop: 41, titleRotate: -0.6, traceLeft: 21, descTop: 57, bendTop: 69, stepWidth: 22 },
];

const VIOLET_SEGMENT_WIDTH = 14;
/** Character budget for the decorative title fragment — chosen so 1-3
 * whole words fit the cover without ever needing CSS ellipsis/truncation. */
const MAX_FRAGMENT_CHARS = 16;

/**
 * The "cover" of one reflection — an abstract editorial signal plate, not
 * a paragraph. No invented prose, no excerpt fragments: only the entry's
 * own date and a short, naturally-ending title fragment, plus a single
 * restrained geometric path and the app's signal mark. Three depth
 * planes, each using the existing translateZ system (see
 * .reflection-layer-back/-mid/-front in index.css) so hover/focus
 * separation works automatically:
 *   BACK    — the day-of-month/month (fixed top-right, every card), a
 *             small balancing tick, and the trace's neutral descent+step.
 *   MIDDLE  — the 1-3 word title fragment, in the upper-middle band.
 *   FRONT   — the trace's short dusty-violet resolution segment and the
 *             signal mark it terminates in — deliberately apart from the
 *             title, not attached to it like a status dot.
 * Purely decorative (aria-hidden) — the real accessible title/date/
 * excerpt live in the info panel below with their own ids/aria wiring,
 * untouched by anything here.
 */
const ReflectionVisualSurface: React.FC<{ entry: JournalEntry; formattedDate: string }> = ({ entry, formattedDate }) => {
  const [, month, day] = entry.date.split('-');
  const dayNumber = day || '';
  const monthLabel = useMemo(() => {
    const [y, m, d] = entry.date.split('-').map(Number);
    if (!y || !m || !d) return '';
    const localDate = new Date(y, m - 1, d);
    if (Number.isNaN(localDate.getTime())) return '';
    return new Intl.DateTimeFormat(undefined, { month: 'short' }).format(localDate).toUpperCase();
  }, [entry.date]);

  const titleFragment = useMemo(() => {
    const words = (entry.title || 'Untitled Reflection').trim().split(/\s+/).filter(Boolean);
    let result = words[0] || 'Untitled';
    for (let i = 1; i < Math.min(words.length, 3); i++) {
      const candidate = `${result} ${words[i]}`;
      if (candidate.length > MAX_FRAGMENT_CHARS) break;
      result = candidate;
    }
    return result;
  }, [entry.title]);

  const variant = VISUAL_VARIANTS[hashId(entry.id) % VISUAL_VARIANTS.length];
  const signalLeft = variant.traceLeft + variant.stepWidth + VIOLET_SEGMENT_WIDTH;

  return (
    <div aria-hidden="true" className="reflection-visual-scene pointer-events-none relative h-28 shrink-0 overflow-hidden sm:h-32">
      <div className="reflection-visual-tilt absolute inset-0">
        <div className="journal-atmosphere reflection-visual-surface absolute inset-0">
          <div className="journal-atmosphere-grain" />
          <div className="journal-atmosphere-dots" />
          <div className="reflection-visual-edge-light" />

          {/* SAFE AREA — every decorative element below is positioned
              relative to this inset box (not the raw card edges), so
              nothing can ever sit flush against — or escape past — the
              card boundary. ~20px top / 18px sides / 16px bottom. */}
          <div className="absolute left-[18px] right-[18px] top-5 bottom-4">
            {/* BACK — the date, fixed top-right on every card (never
                varies — this is the one thing that must stay perfectly
                consistent across the archive). */}
            <div className="reflection-layer-back absolute right-0 top-0 flex flex-col items-end">
              <span className="font-serif text-[2.5rem] font-bold leading-none text-journal-ink-faint/70 sm:text-[2.9rem]">
                {dayNumber}
              </span>
              <span className="-mt-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-journal-ink-muted/60">
                {monthLabel}
              </span>
            </div>

            {/* BACK — a small neutral balancing tick, opposite the date.
                Geometric only — no text. Hidden on mobile; date + title
                fragment + rule + signal mark are the mobile-essential set. */}
            <div className="reflection-layer-back absolute left-0 top-0 hidden sm:block">
              <span className="block h-px w-4 origin-left rotate-[35deg] bg-journal-ink-muted/20" />
            </div>

            {/* MIDDLE — a short title fragment (1-3 whole words, never
                CSS-truncated), sitting inward and downward in the
                upper-middle band — floating inside the plate rather than
                pinned to the top-left corner. */}
            <div
              className="reflection-layer-mid absolute max-w-[54%]"
              style={{ left: `${variant.titleLeft}%`, top: `${variant.titleTop}%`, transform: `rotate(${variant.titleRotate}deg)` }}
            >
              <span className="block whitespace-nowrap font-serif text-base font-semibold leading-none text-journal-ink/80 sm:text-lg">
                {titleFragment}
              </span>
            </div>

            {/* BACK — a single restrained neutral trace: it begins below
                the title (never touching it), descends a short distance,
                then steps toward the lower-middle area where it hands
                off to the violet resolution segment. */}
            <div
              className="reflection-layer-back absolute w-px bg-journal-ink-muted/20"
              style={{ left: `${variant.traceLeft}%`, top: `${variant.descTop}%`, height: `${variant.bendTop - variant.descTop}%` }}
            />
            <div
              className="reflection-layer-back absolute h-px bg-journal-ink-muted/25"
              style={{ left: `${variant.traceLeft}%`, top: `${variant.bendTop}%`, width: `${variant.stepWidth}%` }}
            />

            {/* FRONT — the trace resolves into a short dusty-violet
                segment, which terminates in the signal mark: kept apart
                from the title, so it reads as the path's destination —
                not a status dot attached to text. */}
            <div
              className="reflection-layer-front absolute h-px bg-journal-accent-bright/55"
              style={{ left: `${variant.traceLeft + variant.stepWidth}%`, top: `${variant.bendTop}%`, width: `${VIOLET_SEGMENT_WIDTH}%` }}
            />
            <div
              className="reflection-layer-front absolute flex items-center"
              style={{ left: `${signalLeft}%`, top: `${variant.bendTop}%`, transform: 'translate(-50%, -50%)' }}
            >
              <SignalMark className="h-5 w-5 text-journal-accent-bright [overflow:visible]" />
              <span className="sr-only">{formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const JournalList: React.FC<JournalListProps> = ({
  entries,
  loading,
  userId,
  onSelectEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{
    type: 'success' | 'info' | 'error';
    message: string;
  } | null>(null);
  const [rememberedSignals, setRememberedSignals] = useState<RememberedSignal[]>([]);

  useEffect(() => {
    setRememberedSignals([]);
    if (!userId) return;

    return subscribeUserRememberedSignals(userId, setRememberedSignals);
  }, [userId]);

  const nextMove = useMemo(() => selectNextMove(rememberedSignals), [rememberedSignals]);

  const handleImportSamples = async () => {
    if (!userId || importing) return;

    setImporting(true);
    setImportFeedback(null);

    try {
      const { added, existing } = await importSampleEntries(userId);

      if (added === 9) {
        setImportFeedback({ type: 'success', message: '9 sample reflections added to your journal.' });
      } else if (added > 0 && existing > 0) {
        setImportFeedback({
          type: 'success',
          message: added + ' sample reflections added. ' + existing + ' already existed.',
        });
      } else if (added === 0) {
        setImportFeedback({ type: 'info', message: 'Sample reflections are already in your journal.' });
      }
    } catch (err: any) {
      console.error('Error importing sample reflections:', err);
      setImportFeedback({ type: 'error', message: 'Failed to import sample reflections. Please try again.' });
    } finally {
      setImporting(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().includes(q) ||
        entry.situation?.toLowerCase().includes(q) ||
        entry.behaviorOrEvent?.toLowerCase().includes(q) ||
        entry.feelingOrReaction?.toLowerCase().includes(q) ||
        entry.summary?.situation?.toLowerCase().includes(q) ||
        entry.summary?.feelingOrReaction?.toLowerCase().includes(q) ||
        entry.summary?.theme?.toLowerCase().includes(q) ||
        entry.summary?.emotionalTone?.toLowerCase().includes(q) ||
        entry.summary?.interpretation?.toLowerCase().includes(q) ||
        entry.summary?.subjects?.some((subject) => subject.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="space-y-3 py-20 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-journal-border border-t-accent-primary" />
        <p className="text-sm font-medium text-journal-ink-muted">Loading your private reflection journal…</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* The archive environment — its own neutral-graphite dark surface
          with a sparing dusty-violet accent (independent of Auth's
          palette). Contains the intro, search, count, and the reflection
          grid itself. */}
      <div className="journal-atmosphere relative isolate overflow-hidden">
        <div className="journal-atmosphere-glow" />
        <div className="journal-atmosphere-grain" />
        <div className="journal-atmosphere-dots" />

        <div className="relative z-10 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
          <div className="mx-auto max-w-xl text-center">
            <h2 className="font-serif text-3xl font-semibold uppercase tracking-[0.08em] text-journal-ink sm:text-4xl">
              Journal
            </h2>
            <p className="mt-3 font-serif text-base italic text-journal-ink-muted sm:text-lg">
              Your reflections, collected over time.
            </p>
          </div>

          <div className="mx-auto mt-8 flex max-w-xs flex-col items-center gap-2 sm:max-w-sm">
            <label htmlFor="journal-search-input" className="mb-1 block w-full text-center text-xs font-semibold uppercase tracking-wide text-journal-ink-muted">
              Search
            </label>
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-journal-ink-muted" aria-hidden="true" />
              <input
                id="journal-search-input"
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search your reflections"
                className="min-h-11 w-full rounded-control border border-journal-border bg-journal-panel/40 py-2 pl-9 pr-3 text-center text-sm text-journal-ink placeholder:text-journal-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journal-accent-bright"
              />
            </div>
            <p className="text-xs text-journal-ink-muted">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'reflection' : 'reflections'}
              {searchQuery && filteredEntries.length !== entries.length ? ' matching ' + entries.length + ' total' : ''}
            </p>
          </div>

          {nextMove && <NextMoveCard nextMove={nextMove} />}

          <div className="mt-10 sm:mt-12">
            {entries.length === 0 ? (
              <div className="mx-auto max-w-reading rounded-feature border border-journal-border bg-journal-panel-2 px-6 py-10 text-center sm:px-10 sm:py-12">
                <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-journal-bg text-journal-ink-muted">
                  <BookOpen className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="font-serif text-lg font-semibold text-journal-ink">
                  Your reflections will collect here over time.
                </h3>
                <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-journal-ink-muted">
                  Begin with whatever feels worth noticing today.
                </p>

                <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
                  <button
                    id="start-first-reflection-button"
                    type="button"
                    onClick={onNewEntry}
                    className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-accent-primary px-4 text-base font-semibold text-white shadow-low transition-transform hover:bg-accent-primary-hover active:scale-[0.985] sm:w-auto sm:text-sm"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Write your first reflection</span>
                  </button>

                  {userId && (
                    <button
                      id="import-sample-empty-state-btn"
                      type="button"
                      onClick={handleImportSamples}
                      disabled={importing}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-journal-border bg-journal-bg px-4 text-base font-medium text-journal-ink-muted hover:text-journal-ink disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm"
                    >
                      {importing ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          <span>Adding samples…</span>
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4" aria-hidden="true" />
                          <span>Add sample reflections</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="mx-auto max-w-reading rounded-card border border-journal-border bg-journal-panel-2 px-6 py-10 text-center">
                <h3 className="font-serif text-lg font-semibold text-journal-ink">No matching reflections</h3>
                <p className="mt-2 text-sm text-journal-ink-muted">Try a different word or clear the search field.</p>
              </div>
            ) : (
              <ul className="journal-archive-grid mx-auto grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8" aria-label="Reflections">
                {filteredEntries.map((entry, index) => {
                  const hasReflections = entry.reflections && entry.reflections.length > 0;
                  const userExcerpt =
                    entry.content || entry.situation || entry.behaviorOrEvent || 'No narrative recorded.';
                  const aiPreview =
                    entry.summary?.interpretation ||
                    entry.summary?.theme ||
                    entry.summary?.feelingOrReaction ||
                    entry.summary?.situation;
                  const formattedDate = formatEntryDate(entry.date);

                  return (
                    <li key={entry.id}>
                      <article
                        className="journal-archive-card animate-settle-in group relative flex h-full flex-col overflow-hidden rounded-feature border border-journal-border bg-journal-bg"
                        style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                      >
                        <ReflectionVisualSurface entry={entry} formattedDate={formattedDate} />

                        <div className="flex flex-1 flex-col border-t border-journal-border bg-journal-panel p-5 sm:p-6">
                          <time id={'reflection-date-' + entry.id} dateTime={entry.date} className="block text-xs font-semibold uppercase tracking-wide text-journal-ink-muted">
                            {formattedDate}
                          </time>

                          <h3 className="mt-2 font-serif text-lg font-semibold leading-snug tracking-tight text-journal-ink transition-colors duration-[var(--duration-fast)] group-hover:text-journal-accent-bright sm:text-xl">
                            <button
                              type="button"
                              id={'journal-card-' + entry.id}
                              onClick={() => onSelectEntry(entry)}
                              aria-describedby={
                                'reflection-date-' + entry.id +
                                ' reflection-excerpt-' + entry.id +
                                (entry.summary ? ' reflection-ai-' + entry.id : '') +
                                (hasReflections ? ' reflection-dialogue-' + entry.id : '')
                              }
                              className="text-left after:absolute after:inset-0 after:z-10 after:rounded-feature after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                            >
                              {entry.title || 'Untitled Reflection'}
                              <span className="sr-only"> — open reflection</span>
                            </button>
                          </h3>

                          <p id={'reflection-excerpt-' + entry.id} className="mt-3 line-clamp-3 font-serif text-sm leading-relaxed text-journal-ink-muted">
                            {userExcerpt}
                          </p>

                          {entry.summary && (
                            aiPreview ? (
                              <div id={'reflection-ai-' + entry.id} className="mt-4 border-l-2 border-journal-accent/65 pl-3 font-sans">
                                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-journal-accent-bright">
                                  <SignalGlyph />
                                  AI observation
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-journal-ink-muted">{aiPreview}</p>
                              </div>
                            ) : (
                              <p id={'reflection-ai-' + entry.id} className="mt-4 flex items-center gap-1.5 text-[11px] font-medium text-journal-ink-muted">
                                <span className="text-journal-accent-bright"><SignalGlyph /></span>
                                AI observations available
                              </p>
                            )
                          )}

                          <div className="mt-auto pt-4">
                            {hasReflections && (
                              <p id={'reflection-dialogue-' + entry.id} className="flex items-center gap-1.5 text-xs text-journal-ink-muted">
                                <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                                {entry.reflections.length}{' '}
                                {entry.reflections.length === 1 ? 'dialogue exchange' : 'dialogue exchanges'}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {entries.length > 0 && userId && (
            <div className="mt-8 border-t border-journal-border pt-5">
              <button
                id="import-sample-reflections-top-btn"
                type="button"
                onClick={handleImportSamples}
                disabled={importing}
                className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-journal-ink-muted transition-colors hover:bg-journal-panel hover:text-journal-ink disabled:cursor-not-allowed disabled:opacity-50"
                title="Add the 9 sample reflections to your personal Firestore journal"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Adding samples…</span>
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" aria-hidden="true" />
                    <span>Add sample reflections</span>
                  </>
                )}
              </button>
            </div>
          )}

          {importFeedback && (
            <div
              id="import-sample-feedback-banner"
              role={importFeedback.type === 'error' ? 'alert' : 'status'}
              aria-live={importFeedback.type === 'error' ? 'assertive' : 'polite'}
              className={
                'mt-4 flex items-center justify-between rounded-card border p-3.5 text-sm ' +
                (importFeedback.type === 'error'
                  ? 'border-destructive/40 bg-destructive/15 text-red-300'
                  : importFeedback.type === 'info'
                    ? 'border-journal-border bg-journal-panel text-journal-ink'
                    : 'border-positive/40 bg-positive/15 text-emerald-300')
              }
            >
              <div className="flex items-center gap-2">
                {importFeedback.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : importFeedback.type === 'info' ? (
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span>{importFeedback.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setImportFeedback(null)}
                className="ml-3 min-h-11 rounded-control px-2 text-sm font-medium text-journal-ink-muted transition-colors hover:bg-journal-bg hover:text-journal-ink"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

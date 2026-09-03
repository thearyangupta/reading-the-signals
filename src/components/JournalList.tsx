import React, { useMemo, useState } from 'react';
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
import { importSampleEntries } from '../lib/firebase';
import { JournalEntry } from '../types';

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
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent-primary" />
        <p className="text-sm font-medium text-text-muted">Loading your private reflection journal…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <div className="max-w-reading">
          <label htmlFor="journal-search-input" className="mb-2 block text-sm font-semibold text-text-primary">
            Search reflections
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <input
              id="journal-search-input"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search your journal"
              className="min-h-11 w-full rounded-control border border-border bg-surface py-2.5 pl-10 pr-4 text-base text-text-primary shadow-low placeholder:text-text-muted sm:text-sm"
            />
          </div>
        </div>

        <p className="text-sm text-text-muted">
          {filteredEntries.length} {filteredEntries.length === 1 ? 'reflection' : 'reflections'}
          {searchQuery && filteredEntries.length !== entries.length ? ' matching ' + entries.length + ' total' : ''}
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="mx-auto max-w-reading rounded-feature border border-border bg-surface px-6 py-10 text-center sm:px-10 sm:py-12">
          <div className="mx-auto mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-surface-subtle text-text-secondary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 className="font-serif text-lg font-semibold text-text-primary">
            Your reflections will collect here over time.
          </h3>
          <p className="mx-auto mb-6 mt-2 max-w-sm text-sm text-text-secondary">
            Begin with whatever feels worth noticing today.
          </p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <button
              id="start-first-reflection-button"
              type="button"
              onClick={onNewEntry}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-accent-primary px-4 text-base font-semibold text-white shadow-low hover:bg-accent-primary-hover sm:w-auto sm:text-sm"
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
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 text-base font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:text-sm"
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
        <div className="rounded-card border border-border bg-surface px-6 py-10 text-center">
          <h3 className="font-serif text-lg font-semibold text-text-primary">No matching reflections</h3>
          <p className="mt-2 text-sm text-text-secondary">Try a different word or clear the search field.</p>
        </div>
      ) : (
        <ul className="space-y-4" aria-label="Reflections">
          {filteredEntries.map((entry) => {
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
                <article className="group relative w-full rounded-card border border-border bg-surface-user p-5 text-left shadow-low transition-[border-color,background-color] duration-[var(--duration-base)] hover:border-border-strong hover:bg-surface sm:p-6">
                  <div>
                    <time id={'reflection-date-' + entry.id} dateTime={entry.date} className="block text-xs font-medium text-text-muted">
                      {formattedDate}
                    </time>

                    <h3 className="mt-2 font-serif text-lg font-semibold leading-snug text-text-primary transition-colors duration-[var(--duration-fast)] group-hover:text-user-accent sm:text-xl">
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
                        className="text-left after:absolute after:inset-0 after:z-10 after:rounded-card after:content-[''] focus-visible:outline-none focus-visible:after:outline-3 focus-visible:after:outline-offset-2 focus-visible:after:outline-focus"
                      >
                        {entry.title || 'Untitled Reflection'}
                        <span className="sr-only"> — open reflection</span>
                      </button>
                    </h3>

                    <p id={'reflection-excerpt-' + entry.id} className="mt-3 line-clamp-3 max-w-reading font-serif text-base leading-relaxed text-text-secondary sm:text-lg">
                      {userExcerpt}
                    </p>

                    {entry.summary && (
                      aiPreview ? (
                        <div id={'reflection-ai-' + entry.id} className="mt-5 rounded-control border border-border-ai bg-surface-ai px-4 py-3 font-sans">
                          <p className="flex items-center gap-2 text-xs font-semibold text-accent-primary">
                            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                            AI observation
                          </p>
                          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-secondary">{aiPreview}</p>
                        </div>
                      ) : (
                        <p id={'reflection-ai-' + entry.id} className="mt-5 flex items-center gap-2 text-xs font-medium text-text-muted">
                          <Sparkles className="h-3.5 w-3.5 text-accent-primary" aria-hidden="true" />
                          AI observations available
                        </p>
                      )
                    )}

                    {hasReflections && (
                      <p id={'reflection-dialogue-' + entry.id} className="mt-4 flex items-center gap-2 text-xs text-text-muted">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                        {entry.reflections.length}{' '}
                        {entry.reflections.length === 1 ? 'dialogue exchange' : 'dialogue exchanges'}
                      </p>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {entries.length > 0 && userId && (
        <div className="border-t border-border pt-5">
          <button
            id="import-sample-reflections-top-btn"
            type="button"
            onClick={handleImportSamples}
            disabled={importing}
            className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-text-secondary hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
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
            'flex items-center justify-between rounded-card border p-3.5 text-sm shadow-low ' +
            (importFeedback.type === 'error'
              ? 'border-destructive/30 bg-destructive/5 text-destructive'
              : importFeedback.type === 'info'
                ? 'border-border bg-surface-subtle text-text-primary'
                : 'border-positive/30 bg-positive/5 text-positive')
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
            className="ml-3 min-h-11 rounded-control px-2 text-sm font-medium text-text-secondary hover:bg-surface hover:text-text-primary"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

import React, { useMemo } from 'react';
import { JournalEntry, PersonalTheme, PersonalThemesResult } from '../types';
import { AlertCircle, Calendar, FileText, HelpCircle, Info, Loader2, RefreshCw, Sparkles, Tag } from 'lucide-react';

interface PersonalThemesViewProps {
  targetEntries: JournalEntry[];
  allEntries: JournalEntry[];
  result: PersonalThemesResult | null;
  loading: boolean;
  error: string | null;
  onAnalyzeThemes: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

export const PersonalThemesView: React.FC<PersonalThemesViewProps> = ({
  targetEntries, allEntries, result, loading, error, onAnalyzeThemes, onSelectEntry,
}) => {
  const entryLookup = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    for (const entry of allEntries) map.set(entry.id, entry);
    return map;
  }, [allEntries]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return dateStr;
      return new Date(year, month - 1, day).toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isScopeEmpty = targetEntries.length === 0;
  const isSingleEntry = targetEntries.length === 1;
  const canAnalyze = !loading && targetEntries.length >= 2;

  if (isScopeEmpty) {
    return (
      <section id="personal-themes-empty-scope" className="space-y-2 border-t border-border py-6">
        <h4 className="font-serif text-base font-semibold text-text-primary">Themes need reflections to draw from</h4>
        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
          Add eligible reflections to this scope before looking for recurring subjects.
        </p>
      </section>
    );
  }

  if (isSingleEntry) {
    return (
      <section id="personal-themes-single-entry-scope" className="space-y-2 border-t border-border py-6">
        <h4 className="font-serif text-base font-semibold text-text-primary">Include another reflection</h4>
        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
          Themes need at least two reflections in the current scope so recurring subjects can be considered across entries.
        </p>
      </section>
    );
  }

  return (
    <div id="personal-themes-container" className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
          Notice recurring subjects, concerns, and questions across your reflections.
        </p>
        <button
          id="find-personal-themes-btn"
          type="button"
          onClick={onAnalyzeThemes}
          disabled={!canAnalyze}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted disabled:shadow-none sm:w-auto"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Looking for themes…</span></>
            : result ? <><RefreshCw className="h-4 w-4" aria-hidden="true" /><span>Refresh themes</span></>
              : <><Sparkles className="h-4 w-4" aria-hidden="true" /><span>Find Themes</span></>}
        </button>
      </div>

      {error && (
        <div id="personal-themes-error-banner" role="alert" className="flex flex-col items-start justify-between gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <div><p className="font-semibold">AI observations could not be generated</p><p className="mt-1 leading-relaxed">{error}</p></div>
          </div>
          <button type="button" onClick={onAnalyzeThemes} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-semibold text-red-700 underline underline-offset-2 hover:bg-red-100 hover:text-red-900">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /><span>Retry</span>
          </button>
        </div>
      )}

      {loading && (
        <div id="personal-themes-loading-state" role="status" aria-live="polite" className="space-y-3 py-12 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent-primary" aria-hidden="true" />
          <p className="font-serif text-base font-semibold text-text-primary">Looking across the reflections in this scope…</p>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
            AI is gathering recurring subjects supported by more than one of your recorded reflections.
          </p>
        </div>
      )}

      {!loading && !result && !error && (
        <div id="personal-themes-initial-prompt" className="space-y-2 border-t border-border py-8 text-center">
          <h4 className="font-serif text-base font-semibold text-text-primary">No AI observations yet</h4>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
            Find Themes when you are ready to look for recurring subjects in the current scope.
          </p>
        </div>
      )}

      {result && (
        <section aria-labelledby="themes-ai-observations-title" className="space-y-6 border-t border-border pt-5">
          <div className="space-y-1">
            <h4 id="themes-ai-observations-title" className="font-serif text-lg font-semibold text-text-primary">AI observations</h4>
            <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
              Generated only from the reflections included in the current scope. These themes are organizing lenses for reflection, not facts, diagnoses, or fixed identity labels.
            </p>
          </div>

          {result.message && result.themes.length > 0 && (
            <div className="flex items-start gap-3 rounded-card bg-surface-ai px-4 py-3 text-sm text-text-secondary">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
              <p className="leading-relaxed">{result.message}</p>
            </div>
          )}

          {result.themes.length === 0 ? (
            <div id="personal-themes-no-qualifying" className="space-y-2 py-8 text-center">
              <Tag className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
              <h5 className="font-serif text-base font-semibold text-text-primary">No recurring themes yet</h5>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                {result.message || 'The reflections in this scope do not yet show a recurring theme supported by more than one entry.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {result.themes.map((theme: PersonalTheme) => (
                <article key={theme.id} id={`theme-card-${theme.id}`} className="min-w-0 space-y-5 rounded-card border border-border bg-surface p-4 shadow-low sm:p-6">
                  <div className="space-y-3">
                    <p className="text-sm font-semibold uppercase tracking-[0.08em] text-accent-primary">Theme</p>
                    <h5 className="[overflow-wrap:anywhere] font-serif text-xl font-semibold leading-snug text-text-primary">{theme.name}</h5>
                    {theme.groundedSummary && <p className="max-w-reading font-serif text-base leading-relaxed text-text-primary sm:text-lg">{theme.groundedSummary}</p>}
                  </div>

                  {theme.reflectionQuestion && (
                    <div className="flex items-start gap-3 border-l-2 border-border-ai pl-4">
                      <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                      <div className="min-w-0 space-y-1">
                        <p className="text-sm font-semibold text-text-secondary">Question to sit with</p>
                        <p className="font-serif text-base italic leading-relaxed text-text-primary">{theme.reflectionQuestion}</p>
                      </div>
                    </div>
                  )}

                  {theme.observedSignals && theme.observedSignals.length > 0 && (
                    <section className="space-y-3 border-t border-border pt-4">
                      <h6 className="font-serif text-base font-semibold text-text-primary">From your reflections</h6>
                      <div className="divide-y divide-border">
                        {theme.observedSignals.map((item, idx) => {
                          const sourceEntry = entryLookup.get(item.entryId);
                          return (
                            <div key={`${theme.id}-sig-${idx}`} className="min-w-0 space-y-2 py-4 first:pt-0 last:pb-0">
                              <p className="font-serif text-base leading-relaxed text-text-primary">&ldquo;{item.signal}&rdquo;</p>
                              {sourceEntry ? (
                                <button type="button" onClick={() => onSelectEntry(sourceEntry)} className="flex min-h-11 w-full min-w-0 max-w-full flex-col items-start justify-center gap-0.5 rounded-control px-2 text-left text-sm text-accent-secondary hover:bg-surface-subtle hover:text-text-primary sm:w-auto sm:flex-row sm:items-center sm:gap-2">
                                  <span className="flex min-w-0 max-w-full items-center gap-2 font-semibold">
                                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{sourceEntry.title}</span>
                                  </span>
                                  <span className="pl-6 text-[13px] text-text-muted sm:pl-0">{formatDate(sourceEntry.date)}</span>
                                </button>
                              ) : (
                                <div className="flex min-w-0 flex-col gap-0.5 text-sm text-text-muted sm:flex-row sm:items-center sm:gap-2">
                                  <span className="flex min-w-0 items-center gap-2 font-semibold text-text-secondary">
                                    <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    <span className="min-w-0 [overflow-wrap:anywhere]">{item.entryTitle || item.entryId}</span>
                                  </span>
                                  {item.entryDate && <span className="pl-6 text-[13px] sm:pl-0">{formatDate(item.entryDate)}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <div className="flex flex-col gap-2 border-t border-border pt-4 text-sm text-text-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
                    <span><strong className="font-semibold text-text-secondary">Journal support:</strong> {theme.frequency} {theme.frequency === 1 ? 'reflection' : 'reflections'}</span>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="[overflow-wrap:anywhere]">{formatDate(theme.firstSeenDate)} – {formatDate(theme.lastSeenDate)}</span>
                    </span>
                  </div>

                  <section className="space-y-3 border-t border-border pt-4">
                    <h6 className="font-serif text-base font-semibold text-text-primary">Supporting reflections ({theme.supportingEntryIds.length})</h6>
                    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {theme.supportingEntryIds.map((id) => {
                        const entry = entryLookup.get(id);
                        if (!entry) return null;
                        return (
                          <button key={id} type="button" onClick={() => onSelectEntry(entry)} className="flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-control border border-border bg-surface-user px-3 py-2 text-left text-sm text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary sm:w-auto" title={`View "${entry.title}" (${entry.date})`}>
                            <FileText className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate font-semibold">{entry.title}</span>
                            <span className="shrink-0 text-[13px] text-text-muted">{formatDate(entry.date)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

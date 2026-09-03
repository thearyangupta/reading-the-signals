import React, { useState, useMemo, useEffect } from 'react';
import {
  JournalEntry,
  ReflectionConnection,
  ReflectionConnectionsResult,
  ReflectionConnectionType,
} from '../types';
import {
  AlertCircle,
  ArrowDown,
  ArrowRight,
  Calendar,
  FileText,
  Filter,
  GitCommit,
  HelpCircle,
  Layers,
  Loader2,
  RefreshCw,
  Sparkles,
  Split,
} from 'lucide-react';

interface ReflectionConnectionsViewProps {
  targetEntries: JournalEntry[];
  allEntries: JournalEntry[];
  result: ReflectionConnectionsResult | null;
  loading: boolean;
  error: string | null;
  onAnalyzeConnections: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

export const ReflectionConnectionsView: React.FC<ReflectionConnectionsViewProps> = ({
  targetEntries,
  allEntries,
  result,
  loading,
  error,
  onAnalyzeConnections,
  onSelectEntry,
}) => {
  const [focusEntryId, setFocusEntryId] = useState<string>('all');

  // Deterministic effective scope key based on exact sorted target entry IDs
  const currentScopeKey = useMemo(() => {
    return JSON.stringify(targetEntries.map((e) => e.id).sort());
  }, [targetEntries]);

  // Reset local focus filter to "All Reflections" whenever targetEntries scope changes
  useEffect(() => {
    setFocusEntryId('all');
  }, [currentScopeKey]);

  // Lookup map for resolving entry titles, dates, and details from all available entries
  const entryLookup = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    for (const entry of allEntries) {
      map.set(entry.id, entry);
    }
    return map;
  }, [allEntries]);

  // Format date helper: YYYY-MM-DD -> e.g. "Aug 3, 2026"
  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-').map(Number);
      if (!year || !month || !day) return dateStr;
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const isScopeEmpty = targetEntries.length === 0;
  const isSingleEntry = targetEntries.length === 1;
  const canAnalyze = !loading && targetEntries.length >= 2;

  // Filter connections client-side based on the selected focus reflection
  const filteredConnections = useMemo(() => {
    if (!result || !result.connections) return [];
    if (focusEntryId === 'all') return result.connections;
    return result.connections.filter(
      (c) => c.sourceEntryId === focusEntryId || c.targetEntryId === focusEntryId
    );
  }, [result, focusEntryId]);

  const getConnectionTypeConfig = (type: ReflectionConnectionType) => {
    switch (type) {
      case 'shared_signal':
        return {
          label: 'Shared signal',
          icon: GitCommit,
          description: 'Both reflections include a related recorded signal.',
        };
      case 'contrasting_interpretation':
        return {
          label: 'Different interpretations',
          icon: Split,
          description: 'Related situations are interpreted differently in the two reflections.',
        };
      case 'parallel_context':
        return {
          label: 'Parallel contexts',
          icon: Layers,
          description: 'Different situations contain a related context or recorded reaction.',
        };
      default:
        return {
          label: 'Connection',
          icon: Sparkles,
          description: 'A possible connection between two recorded reflections.',
        };
    }
  };

  if (isScopeEmpty) {
    return (
      <section id="reflection-connections-empty-scope" className="space-y-2 border-t border-border py-6">
        <h4 className="font-serif text-base font-semibold text-text-primary">Connections need reflections to draw from</h4>
        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
          Add eligible reflections to this scope before looking for relationships between them.
        </p>
      </section>
    );
  }

  if (isSingleEntry) {
    return (
      <section id="reflection-connections-single-entry-scope" className="space-y-2 border-t border-border py-6">
        <h4 className="font-serif text-base font-semibold text-text-primary">Include another reflection</h4>
        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
          Connections need at least two reflections in the current scope so they can be considered alongside each other.
        </p>
      </section>
    );
  }

  return (
    <div id="reflection-connections-container" className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
          Notice how two reflections may echo, differ, or sit alongside each other.
        </p>
        <button
          id="find-connections-btn"
          type="button"
          onClick={onAnalyzeConnections}
          disabled={!canAnalyze}
          className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted disabled:shadow-none sm:w-auto"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /><span>Looking for connections…</span></>
          ) : result ? (
            <><RefreshCw className="h-4 w-4" aria-hidden="true" /><span>Refresh connections</span></>
          ) : (
            <><Sparkles className="h-4 w-4" aria-hidden="true" /><span>Find Connections</span></>
          )}
        </button>
      </div>

      {error && (
        <div id="reflection-connections-error-banner" role="alert" className="flex flex-col items-start justify-between gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <div><p className="font-semibold">AI observations could not be generated</p><p className="mt-1 leading-relaxed">{error}</p></div>
          </div>
          <button type="button" onClick={onAnalyzeConnections} className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-semibold text-red-700 underline underline-offset-2 hover:bg-red-100 hover:text-red-900">
            <RefreshCw className="h-4 w-4" aria-hidden="true" /><span>Retry</span>
          </button>
        </div>
      )}

      {loading && (
        <div id="reflection-connections-loading-state" role="status" aria-live="polite" className="space-y-3 py-12 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent-primary" aria-hidden="true" />
          <p className="font-serif text-base font-semibold text-text-primary">Looking across the reflections in this scope…</p>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
            AI is considering where recorded signals, contexts, or interpretations may relate.
          </p>
        </div>
      )}

      {!loading && !result && !error && (
        <div id="reflection-connections-initial-prompt" className="space-y-2 border-t border-border py-8 text-center">
          <h4 className="font-serif text-base font-semibold text-text-primary">No AI observations yet</h4>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
            Find Connections when you are ready to consider possible links in the current scope.
          </p>
        </div>
      )}

      {result && (
        <section aria-labelledby="connections-ai-observations-title" className="space-y-6 border-t border-border pt-5">
          <div className="space-y-1">
            <h4 id="connections-ai-observations-title" className="font-serif text-lg font-semibold text-text-primary">AI observations</h4>
            <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
              Generated only from reflections in the current scope. These are interpretive links, not proof that events are objectively connected, diagnoses, explanations of hidden motives, or claims of causation.
            </p>
          </div>

          {result.connections.length === 0 ? (
            <div id="reflection-connections-no-qualifying" className="space-y-2 py-8 text-center">
              <GitCommit className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
              <h5 className="font-serif text-base font-semibold text-text-primary">No clear connections yet</h5>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                {result.message || 'No strongly grounded connections were found in this scope.'}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              {targetEntries.length > 2 && (
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <label htmlFor="connections-filter-select" className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                    <Filter className="h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                    Focus on a reflection
                  </label>
                  <select
                    aria-label="Focus connections on a reflection"
                    id="connections-filter-select"
                    value={focusEntryId}
                    onChange={(e) => setFocusEntryId(e.target.value)}
                    className="min-h-11 w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-base text-text-primary sm:max-w-sm sm:text-sm"
                  >
                    <option value="all">All reflections ({result.connections.length} connections)</option>
                    {targetEntries.map((e) => (
                      <option key={e.id} value={e.id}>{e.title} ({formatDate(e.date)})</option>
                    ))}
                  </select>
                </div>
              )}

              {filteredConnections.length === 0 ? (
                <div className="space-y-3 border-t border-border py-8 text-center text-sm text-text-secondary">
                  <p>No connections involving the selected reflection were found.</p>
                  <button type="button" onClick={() => setFocusEntryId('all')} className="inline-flex min-h-11 items-center rounded-control px-3 font-semibold text-accent-primary underline underline-offset-2 hover:bg-surface-subtle hover:text-accent-primary-hover">
                    Show all connections ({result.connections.length})
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredConnections.map((conn: ReflectionConnection) => {
                    const config = getConnectionTypeConfig(conn.connectionType);
                    const TypeIcon = config.icon;
                    const sourceEntry = entryLookup.get(conn.sourceEntryId);
                    const targetEntry = entryLookup.get(conn.targetEntryId);
                    const connectionHeadingId = `connection-heading-${conn.id}`;

                    return (
                      <article key={conn.id} id={`connection-card-${conn.id}`} aria-labelledby={connectionHeadingId} className="min-w-0 space-y-6 rounded-card border border-border bg-surface p-4 shadow-low sm:p-6">
                        <header className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold text-accent-primary">
                            <TypeIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <h5 id={connectionHeadingId} className="font-serif text-lg font-semibold text-text-primary">{config.label}</h5>
                          </div>
                          <p className="max-w-reading font-serif text-lg leading-relaxed text-text-primary">{conn.groundedReason}</p>
                        </header>

                        <div className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] md:items-stretch">
                          <section className="min-w-0 space-y-4 rounded-card bg-surface-subtle p-4" aria-label="First reflection in this connection">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-text-muted">First reflection</p>
                              <button type="button" onClick={() => { if (sourceEntry) onSelectEntry(sourceEntry); }} className="flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-control px-2 text-left font-serif text-base font-semibold text-text-primary hover:bg-surface hover:text-accent-secondary" title="Click to view full entry">
                                <FileText className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                <span className="min-w-0 [overflow-wrap:anywhere]">{conn.source.entryTitle}</span>
                              </button>
                              <p className="flex items-center gap-2 pl-2 text-[13px] text-text-muted"><Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />{formatDate(conn.source.entryDate)}</p>
                            </div>
                            <div className="divide-y divide-border">
                              {conn.source.observedSignal && <div className="space-y-1 py-3 first:pt-0"><p className="text-sm font-semibold text-text-secondary">Recorded signal</p><p className="font-serif text-base leading-relaxed text-text-primary">{conn.source.observedSignal}</p></div>}
                              {conn.source.recordedInterpretation && <div className="space-y-1 py-3"><p className="text-sm font-semibold text-text-secondary">Recorded interpretation</p><p className="text-sm leading-relaxed text-text-secondary">{conn.source.recordedInterpretation}</p></div>}
                              {conn.source.emotionalTone && <div className="space-y-1 py-3 last:pb-0"><p className="text-sm font-semibold text-text-secondary">Emotional tone</p><p className="text-sm leading-relaxed text-text-secondary">{conn.source.emotionalTone}</p></div>}
                            </div>
                          </section>

                          <div className="flex min-w-0 flex-col items-center justify-center gap-2 px-2 py-2 text-center text-sm text-text-secondary">
                            <ArrowDown className="h-5 w-5 text-accent-primary md:hidden" aria-hidden="true" />
                            <ArrowRight className="hidden h-5 w-5 text-accent-primary md:block" aria-hidden="true" />
                            <p className="leading-snug"><span className="block text-[13px] text-text-muted">Related through</span><strong className="font-semibold text-text-primary">{config.label}</strong></p>
                            <p className="text-[13px] leading-relaxed text-text-muted">{config.description}</p>
                            <ArrowDown className="h-5 w-5 text-accent-primary md:hidden" aria-hidden="true" />
                            <ArrowRight className="hidden h-5 w-5 text-accent-primary md:block" aria-hidden="true" />
                          </div>

                          <section className="min-w-0 space-y-4 rounded-card bg-surface-subtle p-4" aria-label="Second reflection in this connection">
                            <div className="space-y-1">
                              <p className="text-sm font-semibold text-text-muted">Second reflection</p>
                              <button type="button" onClick={() => { if (targetEntry) onSelectEntry(targetEntry); }} className="flex min-h-11 w-full min-w-0 max-w-full items-center gap-2 rounded-control px-2 text-left font-serif text-base font-semibold text-text-primary hover:bg-surface hover:text-accent-secondary" title="Click to view full entry">
                                <FileText className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                <span className="min-w-0 [overflow-wrap:anywhere]">{conn.target.entryTitle}</span>
                              </button>
                              <p className="flex items-center gap-2 pl-2 text-[13px] text-text-muted"><Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />{formatDate(conn.target.entryDate)}</p>
                            </div>
                            <div className="divide-y divide-border">
                              {conn.target.observedSignal && <div className="space-y-1 py-3 first:pt-0"><p className="text-sm font-semibold text-text-secondary">Recorded signal</p><p className="font-serif text-base leading-relaxed text-text-primary">{conn.target.observedSignal}</p></div>}
                              {conn.target.recordedInterpretation && <div className="space-y-1 py-3"><p className="text-sm font-semibold text-text-secondary">Recorded interpretation</p><p className="text-sm leading-relaxed text-text-secondary">{conn.target.recordedInterpretation}</p></div>}
                              {conn.target.emotionalTone && <div className="space-y-1 py-3 last:pb-0"><p className="text-sm font-semibold text-text-secondary">Emotional tone</p><p className="text-sm leading-relaxed text-text-secondary">{conn.target.emotionalTone}</p></div>}
                            </div>
                          </section>
                        </div>

                        {conn.reflectionQuestion && (
                          <div className="flex items-start gap-3 border-l-2 border-border-ai pl-4">
                            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                            <div className="min-w-0 space-y-1"><p className="text-sm font-semibold text-text-secondary">Question to sit with</p><p className="font-serif text-base italic leading-relaxed text-text-primary">{conn.reflectionQuestion}</p></div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

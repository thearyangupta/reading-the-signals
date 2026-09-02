import React, { useState, useMemo, useEffect } from 'react';
import {
  JournalEntry,
  ReflectionConnection,
  ReflectionConnectionsResult,
  ReflectionConnectionType,
} from '../types';
import {
  GitCommit,
  Split,
  Layers,
  Sparkles,
  Loader2,
  Calendar,
  FileText,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  ShieldCheck,
  ArrowRight,
  Filter,
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
          label: 'Shared Signal',
          icon: GitCommit,
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          accentColor: 'text-emerald-700',
          description: 'Both reflections share a related observational or behavioral signal.',
        };
      case 'contrasting_interpretation':
        return {
          label: 'Contrasting Interpretation',
          icon: Split,
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200/80',
          accentColor: 'text-purple-700',
          description: 'Related situations are interpreted differently across the reflections.',
        };
      case 'parallel_context':
        return {
          label: 'Parallel Context',
          icon: Layers,
          badgeBg: 'bg-sky-50 text-sky-800 border-sky-200/80',
          accentColor: 'text-sky-700',
          description: 'Different situations feature a parallel internal or situational reaction.',
        };
      default:
        return {
          label: 'Connection',
          icon: Sparkles,
          badgeBg: 'bg-stone-100 text-stone-800 border-stone-200',
          accentColor: 'text-stone-700',
          description: 'A grounded connection between two reflections.',
        };
    }
  };

  // Case 1: Zero entries in active scope
  if (isScopeEmpty) {
    return (
      <div
        id="reflection-connections-empty-scope"
        className="bg-stone-50/70 border border-dashed border-stone-200 rounded-2xl p-8 text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center mx-auto">
          <GitCommit className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-serif font-semibold text-stone-800">
          No Reflections in Scope
        </h4>
        <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
          Write reflections to begin discovering grounded pairwise connections between what you wrote.
        </p>
      </div>
    );
  }

  // Case 2: Exactly 1 entry in active scope
  if (isSingleEntry) {
    return (
      <div
        id="reflection-connections-single-entry-scope"
        className="bg-amber-50/40 border border-amber-200/60 rounded-2xl p-8 text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-800 border border-amber-200 flex items-center justify-center mx-auto">
          <Layers className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-serif font-semibold text-stone-900">
          Cross-Entry Threshold Required
        </h4>
        <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
          Reflection Connections need at least 2 reflections in the active scope. Include additional reflections in your scope above to discover pairwise relationships.
        </p>
      </div>
    );
  }

  return (
    <div id="reflection-connections-container" className="space-y-6">
      {/* Informative Header Banner & Action Button */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 text-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-amber-100/80 text-amber-800 rounded-lg">
                <GitCommit className="w-4 h-4 text-amber-800" />
              </div>
              <h4 className="text-sm font-serif font-bold text-stone-900 tracking-tight">
                Reflection Connections (Pairwise Signal Mapping)
              </h4>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
              Discovers grounded pairwise relationships between distinct reflections in your active scope ({targetEntries.length} reflections)—such as shared behavioral signals, contrasting interpretations, or parallel contexts. Grounded strictly in structured summaries without psychological profiling.
            </p>
          </div>

          <div className="shrink-0 flex items-center">
            <button
              id="find-connections-btn"
              type="button"
              onClick={onAnalyzeConnections}
              disabled={!canAnalyze}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:bg-stone-200 disabled:text-stone-400 text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Discovering Connections...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{result ? 'Re-analyze Connections' : 'Find Connections'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-stone-200/60 text-[11px] text-stone-500">
          <div className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Authoritative evidence from structured entries</span>
          </div>
          <span className="text-stone-300">•</span>
          <div className="flex items-center space-x-1">
            <GitCommit className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Deduplicated pairwise connections (up to 8)</span>
          </div>
          <span className="text-stone-300">•</span>
          <div className="flex items-center space-x-1">
            <Layers className="w-3.5 h-3.5 text-stone-600 shrink-0" />
            <span>Non-diagnostic observational framing</span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div
          id="reflection-connections-error-banner"
          className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-start space-x-3"
        >
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={onAnalyzeConnections}
              className="inline-flex items-center space-x-1 text-rose-700 hover:text-rose-900 font-medium underline underline-offset-2 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Analysis</span>
            </button>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div
          id="reflection-connections-loading-state"
          className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center space-y-4 shadow-2xs"
        >
          <Loader2 className="w-6 h-6 text-amber-700 animate-spin mx-auto" />
          <div className="space-y-1">
            <h5 className="text-xs font-serif font-semibold text-stone-800">
              Evaluating Grounded Connections Across {targetEntries.length} Reflections...
            </h5>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto leading-relaxed">
              Analyzing shared behavioral signals, contrasting interpretations, and parallel contexts between pairs of reflections.
            </p>
          </div>
        </div>
      )}

      {/* Empty State before running analysis */}
      {!loading && !result && !error && (
        <div
          id="reflection-connections-initial-prompt"
          className="bg-stone-50/60 border border-dashed border-stone-200 rounded-2xl p-8 text-center space-y-3"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5 text-amber-700" />
          </div>
          <h4 className="text-sm font-serif font-semibold text-stone-800">
            Ready to Map Reflection Connections
          </h4>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            Click &quot;Find Connections&quot; to discover grounded relationships between what you recorded across the {targetEntries.length} reflections in your active scope.
          </p>
        </div>
      )}

      {/* Results Rendering */}
      {!loading && result && (
        <>
          {result.connections.length === 0 ? (
            <div
              id="reflection-connections-no-qualifying"
              className="bg-stone-50/70 border border-dashed border-stone-200 rounded-2xl p-8 text-center space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 border border-stone-200 flex items-center justify-center mx-auto">
                <GitCommit className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-serif font-semibold text-stone-800">
                No Grounded Connections Found
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                {result.message || 'No strongly grounded connections were found in this scope.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Optional Client-Side Focus Filter */}
              {targetEntries.length > 2 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1 text-xs text-stone-600">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                    <span className="font-medium text-stone-700">Filter by reflection:</span>
                  </div>
                  <select
                    id="connections-filter-select"
                    value={focusEntryId}
                    onChange={(e) => setFocusEntryId(e.target.value)}
                    className="text-xs bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-700 max-w-xs truncate"
                  >
                    <option value="all">All Reflections ({result.connections.length} connections)</option>
                    {targetEntries.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.title} ({formatDate(e.date)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {filteredConnections.length === 0 ? (
                <div className="bg-stone-50/60 border border-dashed border-stone-200 rounded-xl p-6 text-center space-y-2 text-xs text-stone-500">
                  <p>No connections involving the selected reflection were found.</p>
                  <button
                    type="button"
                    onClick={() => setFocusEntryId('all')}
                    className="text-amber-800 hover:text-amber-900 font-medium underline underline-offset-2 cursor-pointer"
                  >
                    Show all connections ({result.connections.length})
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredConnections.map((conn: ReflectionConnection) => {
                    const config = getConnectionTypeConfig(conn.connectionType);
                    const TypeIcon = config.icon;
                    const sourceEntry = entryLookup.get(conn.sourceEntryId);
                    const targetEntry = entryLookup.get(conn.targetEntryId);

                    return (
                      <div
                        key={conn.id}
                        id={`connection-card-${conn.id}`}
                        className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-2xs hover:border-amber-200/80 transition-all space-y-4"
                      >
                        {/* Card Header: Type Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.badgeBg}`}
                            >
                              <TypeIcon className="w-3.5 h-3.5 shrink-0" />
                              <span>{config.label}</span>
                            </span>
                            <span className="text-[11px] text-stone-400 hidden sm:inline">
                              {config.description}
                            </span>
                          </div>
                        </div>

                        {/* Grounded Reason */}
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-stone-800 leading-relaxed font-normal">
                            {conn.groundedReason}
                          </p>
                        </div>

                        {/* Connected Reflections: Source ↔ Target */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {/* Source Entry */}
                          <div className="bg-stone-50/90 border border-stone-200/70 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                                <span className="font-semibold uppercase tracking-wider text-stone-400">
                                  Earlier Reflection
                                </span>
                                <div className="flex items-center space-x-1 text-stone-400">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(conn.source.entryDate)}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (sourceEntry) {
                                    onSelectEntry(sourceEntry);
                                  }
                                }}
                                className="text-left font-serif font-semibold text-xs sm:text-sm text-stone-900 hover:text-amber-800 transition-colors flex items-center space-x-1.5 group cursor-pointer"
                                title="Click to view full entry"
                              >
                                <FileText className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-700 shrink-0" />
                                <span className="underline decoration-stone-200 group-hover:decoration-amber-700 underline-offset-2">
                                  {conn.source.entryTitle}
                                </span>
                              </button>
                            </div>

                            <div className="space-y-2 pt-1">
                              {conn.source.observedSignal && (
                                <div className="pt-2 border-t border-stone-200/50">
                                  <p className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                                    Observed Signal
                                  </p>
                                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mt-0.5">
                                    {conn.source.observedSignal}
                                  </p>
                                </div>
                              )}

                              {conn.source.recordedInterpretation && (
                                <div className="pt-2 border-t border-stone-200/50">
                                  <p className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                                    Recorded Interpretation
                                  </p>
                                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mt-0.5">
                                    {conn.source.recordedInterpretation}
                                  </p>
                                </div>
                              )}

                              {conn.source.emotionalTone && (
                                <div className="pt-2 border-t border-stone-200/50">
                                  <p className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                                    Emotional Tone
                                  </p>
                                  <p className="text-xs text-stone-600 leading-relaxed mt-0.5">
                                    <span className="inline-block px-2 py-0.5 rounded-full bg-stone-200/70 text-[11px] font-medium text-stone-700">
                                      {conn.source.emotionalTone}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Target Entry */}
                          <div className="bg-stone-50/90 border border-stone-200/70 rounded-xl p-3.5 space-y-2 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                                <span className="font-semibold uppercase tracking-wider text-stone-400">
                                  Later Reflection
                                </span>
                                <div className="flex items-center space-x-1 text-stone-400">
                                  <Calendar className="w-3 h-3" />
                                  <span>{formatDate(conn.target.entryDate)}</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  if (targetEntry) {
                                    onSelectEntry(targetEntry);
                                  }
                                }}
                                className="text-left font-serif font-semibold text-xs sm:text-sm text-stone-900 hover:text-amber-800 transition-colors flex items-center space-x-1.5 group cursor-pointer"
                                title="Click to view full entry"
                              >
                                <FileText className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-700 shrink-0" />
                                <span className="underline decoration-stone-200 group-hover:decoration-amber-700 underline-offset-2">
                                  {conn.target.entryTitle}
                                </span>
                              </button>
                            </div>

                            <div className="space-y-2 pt-1">
                              {conn.target.observedSignal && (
                                <div className="pt-2 border-t border-stone-200/50">
                                  <p className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                                    Observed Signal
                                  </p>
                                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mt-0.5">
                                    {conn.target.observedSignal}
                                  </p>
                                </div>
                              )}

                              {conn.target.recordedInterpretation && (
                                <div className="pt-2 border-t border-stone-200/50">
                                  <p className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                                    Recorded Interpretation
                                  </p>
                                  <p className="text-xs text-stone-600 line-clamp-3 leading-relaxed mt-0.5">
                                    {conn.target.recordedInterpretation}
                                  </p>
                                </div>
                              )}

                              {conn.target.emotionalTone && (
                                <div className="pt-2 border-t border-stone-200/50">
                                  <p className="text-[10px] uppercase font-semibold text-stone-400 tracking-wider">
                                    Emotional Tone
                                  </p>
                                  <p className="text-xs text-stone-600 leading-relaxed mt-0.5">
                                    <span className="inline-block px-2 py-0.5 rounded-full bg-stone-200/70 text-[11px] font-medium text-stone-700">
                                      {conn.target.emotionalTone}
                                    </span>
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Optional Reflection Question */}
                        {conn.reflectionQuestion && (
                          <div className="bg-amber-50/40 border border-amber-200/60 rounded-xl p-3 flex items-start space-x-2.5 text-xs text-amber-950">
                            <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                              <span className="font-semibold text-amber-900 block text-[11px]">
                                Reflection Prompt
                              </span>
                              <p className="text-stone-700 italic leading-relaxed">
                                {conn.reflectionQuestion}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

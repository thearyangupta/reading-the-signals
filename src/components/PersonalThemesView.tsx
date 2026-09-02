import React, { useMemo } from 'react';
import { JournalEntry, PersonalTheme, PersonalThemesResult } from '../types';
import {
  Tag,
  Calendar,
  Layers,
  Sparkles,
  Loader2,
  FileText,
  Clock,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';

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
  targetEntries,
  allEntries,
  result,
  loading,
  error,
  onAnalyzeThemes,
  onSelectEntry,
}) => {
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

  // Case 1: Zero entries in active scope
  if (isScopeEmpty) {
    return (
      <div id="personal-themes-empty-scope" className="bg-stone-50/70 border border-dashed border-stone-200 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center mx-auto">
          <Tag className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-serif font-semibold text-stone-800">
          No Reflections in Scope
        </h4>
        <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
          Write reflections to begin identifying recurring themes.
        </p>
      </div>
    );
  }

  // Case 2: Exactly 1 entry in active scope
  if (isSingleEntry) {
    return (
      <div id="personal-themes-single-entry-scope" className="bg-amber-50/40 border border-amber-200/60 rounded-2xl p-8 text-center space-y-3">
        <div className="w-10 h-10 rounded-xl bg-amber-100/70 text-amber-800 border border-amber-200 flex items-center justify-center mx-auto">
          <Layers className="w-5 h-5" />
        </div>
        <h4 className="text-sm font-serif font-semibold text-stone-900">
          Cross-Entry Threshold Required
        </h4>
        <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
          Personal Themes need at least 2 reflections in the active scope. Include additional reflections in your scope above to surface recurring thematic domains.
        </p>
      </div>
    );
  }

  return (
    <div id="personal-themes-container" className="space-y-6">
      {/* Informative Header Banner & Action Button */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 text-stone-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1.5 bg-amber-100/80 text-amber-800 rounded-lg">
                <Tag className="w-4 h-4 text-amber-800" />
              </div>
              <h4 className="text-sm font-serif font-bold text-stone-900 tracking-tight">
                Personal Themes (Semantic Domain Clustering)
              </h4>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
              Identifies broad recurring life areas, behavioral patterns, and reflection domains across your structured reflections in the active scope ({targetEntries.length} reflections). Grounded strictly in explicit summaries without clinical diagnosis or entity labeling.
            </p>
          </div>

          <div className="shrink-0 flex items-center">
            <button
              id="find-personal-themes-btn"
              type="button"
              onClick={onAnalyzeThemes}
              disabled={!canAnalyze}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:bg-stone-200 disabled:text-stone-400 text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Discovering Themes...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{result ? 'Re-analyze Themes' : 'Find Personal Themes'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-stone-200/60 text-[11px] text-stone-500">
          <div className="flex items-center space-x-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Evidence-backed (≥2 distinct reflections per theme)</span>
          </div>
          <span className="text-stone-300">•</span>
          <div className="flex items-center space-x-1">
            <Tag className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>Domain-level categories (no isolated person names)</span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div id="personal-themes-error-banner" className="bg-rose-50/80 border border-rose-200 rounded-xl p-4 text-xs text-rose-800 flex items-start space-x-3">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <p className="font-semibold">{error}</p>
            <button
              onClick={onAnalyzeThemes}
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
        <div id="personal-themes-loading-state" className="bg-white border border-stone-200/90 rounded-2xl p-8 text-center space-y-4 shadow-2xs">
          <Loader2 className="w-6 h-6 text-amber-700 animate-spin mx-auto" />
          <div className="space-y-1">
            <h5 className="text-xs font-serif font-semibold text-stone-800">
              Clustering Reflection Domains Across {targetEntries.length} Entries...
            </h5>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto leading-relaxed">
              Evaluating shared behavioral and reflective patterns to organize evidence-backed personal themes.
            </p>
          </div>
        </div>
      )}

      {/* Empty State before running analysis */}
      {!loading && !result && !error && (
        <div id="personal-themes-initial-prompt" className="bg-stone-50/60 border border-dashed border-stone-200 rounded-2xl p-8 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200/60 flex items-center justify-center mx-auto">
            <Sparkles className="w-5 h-5 text-amber-700" />
          </div>
          <h4 className="text-sm font-serif font-semibold text-stone-800">
            Ready to Discover Personal Themes
          </h4>
          <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
            Click &quot;Find Personal Themes&quot; to cluster recurring domains and patterns across the {targetEntries.length} reflections in your active scope.
          </p>
        </div>
      )}

      {/* Results Rendering */}
      {!loading && result && (
        <>
          {result.themes.length === 0 ? (
            <div id="personal-themes-no-qualifying" className="bg-stone-50/70 border border-dashed border-stone-200 rounded-2xl p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 border border-stone-200 flex items-center justify-center mx-auto">
                <Tag className="w-5 h-5" />
              </div>
              <h4 className="text-sm font-serif font-semibold text-stone-800">
                No Recurring Themes Found
              </h4>
              <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                {result.message || 'No grounded recurring personal themes spanning 2 or more reflections were found in the active scope.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {result.themes.map((theme: PersonalTheme) => {
                return (
                  <div
                    key={theme.id}
                    id={`theme-card-${theme.id}`}
                    className="bg-white border border-stone-200/90 rounded-xl p-5 shadow-2xs hover:border-amber-200/80 transition-all flex flex-col justify-between space-y-4"
                  >
                    {/* Card Header: Theme Name & Frequency Badge */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2 min-w-0">
                          <div className="p-1.5 bg-stone-100 rounded-lg text-stone-700 shrink-0">
                            <Tag className="w-3.5 h-3.5 text-amber-800" />
                          </div>
                          <h4 className="text-sm sm:text-base font-serif font-bold text-stone-900 truncate">
                            {theme.name}
                          </h4>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100/70 text-amber-900 border border-amber-200/80 shrink-0 whitespace-nowrap">
                          {theme.frequency} {theme.frequency === 1 ? 'reflection' : 'reflections'}
                        </span>
                      </div>

                      {/* Date Range Meta */}
                      <div className="flex items-center space-x-1.5 text-[11px] text-stone-500">
                        <Calendar className="w-3 h-3 text-stone-400 shrink-0" />
                        <span>
                          {formatDate(theme.firstSeenDate)} – {formatDate(theme.lastSeenDate)}
                        </span>
                      </div>
                    </div>

                    {/* Grounded Summary */}
                    {theme.groundedSummary && (
                      <p className="text-xs text-stone-700 leading-relaxed bg-stone-50/70 rounded-lg p-3 border border-stone-100">
                        {theme.groundedSummary}
                      </p>
                    )}

                    {/* Observed Signals Section */}
                    {theme.observedSignals && theme.observedSignals.length > 0 && (
                      <div className="space-y-2 pt-1 border-t border-stone-100">
                        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-stone-700">
                          <Clock className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>Observed Signals ({theme.observedSignals.length})</span>
                        </div>
                        <div className="space-y-1.5">
                          {theme.observedSignals.map((item, idx) => {
                            const sourceEntry = entryLookup.get(item.entryId);
                            return (
                              <div
                                key={`${theme.id}-sig-${idx}`}
                                className="bg-amber-50/30 border border-amber-100/70 rounded-lg p-2.5 space-y-1"
                              >
                                <p className="text-xs text-stone-800 leading-relaxed font-sans">
                                  &ldquo;{item.signal}&rdquo;
                                </p>
                                {sourceEntry ? (
                                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
                                    <button
                                      type="button"
                                      onClick={() => onSelectEntry(sourceEntry)}
                                      className="inline-flex items-center space-x-1 text-amber-800 hover:text-amber-950 font-medium hover:underline cursor-pointer"
                                    >
                                      <FileText className="w-2.5 h-2.5 text-amber-700" />
                                      <span className="truncate max-w-[200px]">{sourceEntry.title}</span>
                                    </button>
                                    <span className="text-stone-400">{formatDate(sourceEntry.date)}</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-0.5">
                                    <span className="inline-flex items-center space-x-1 text-stone-600 font-medium truncate max-w-[200px]">
                                      <FileText className="w-2.5 h-2.5 text-stone-400" />
                                      <span>{item.entryTitle || item.entryId}</span>
                                    </span>
                                    {item.entryDate && <span className="text-stone-400">{formatDate(item.entryDate)}</span>}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Optional Reflection Question */}
                    {theme.reflectionQuestion && (
                      <div className="bg-stone-50/80 border border-stone-200/80 rounded-lg p-3 text-xs text-stone-700 flex items-start space-x-2">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-amber-900 uppercase tracking-wider block">
                            Reflective Question
                          </span>
                          <p className="italic text-stone-700 leading-relaxed font-serif">
                            {theme.reflectionQuestion}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Supporting Reflections List */}
                    <div className="pt-2 border-t border-stone-100 space-y-2">
                      <span className="text-[11px] font-semibold text-stone-700 block">
                        Supporting Reflections ({theme.supportingEntryIds.length})
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {theme.supportingEntryIds.map((id) => {
                          const entry = entryLookup.get(id);
                          if (!entry) return null;
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => onSelectEntry(entry)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-stone-100 hover:bg-amber-100 text-stone-700 hover:text-amber-950 border border-stone-200/60 hover:border-amber-300 transition-colors cursor-pointer"
                              title={`View "${entry.title}" (${entry.date})`}
                            >
                              <FileText className="w-2.5 h-2.5 text-stone-400 group-hover:text-amber-700" />
                              <span className="max-w-[140px] truncate">{entry.title}</span>
                              <span className="text-stone-400 text-[10px]">({formatDate(entry.date)})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

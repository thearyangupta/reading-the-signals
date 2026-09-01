import React from 'react';
import {
  JournalEntry,
  SignalTimelineResult,
} from '../types';
import {
  Clock,
  ArrowRight,
  Calendar,
  ChevronRight,
  ShieldCheck,
  Milestone,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';

interface ThenVsNowComparisonProps {
  targetEntries: JournalEntry[];
  timelineResult: SignalTimelineResult | null;
  loadingTimeline: boolean;
  onAnalyzeTimeline: () => void;
  onSelectEntry: (entry: JournalEntry) => void;
}

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
      <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-800 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6 text-amber-700" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h4 className="font-serif font-bold text-stone-900 text-base">
            Then vs Now Requires More Reflections
          </h4>
          <p className="text-xs text-stone-600 leading-relaxed">
            Then vs Now requires at least 2 structured reflections in the active scope to identify longitudinal shifts.
          </p>
        </div>
        <div className="inline-flex items-center space-x-2 text-xs text-stone-500 bg-white px-3.5 py-1.5 rounded-full border border-stone-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Current active scope: {targetEntries.length} {targetEntries.length === 1 ? 'reflection' : 'reflections'}</span>
        </div>
      </div>
    );
  }

  // Guard B: Timeline not yet computed for this scope
  if (timelineResult === null) {
    return (
      <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-800 flex items-center justify-center mx-auto">
          <Milestone className="w-6 h-6 text-amber-700" />
        </div>
        <div className="max-w-md mx-auto space-y-1.5">
          <h4 className="font-serif font-bold text-stone-800 text-sm">
            Signal Timeline Not Yet Computed
          </h4>
          <p className="text-xs text-stone-500 leading-relaxed max-w-md mx-auto">
            Signal Timeline has not yet been computed for this scope. Analyze your reflections across time to generate Then vs Now comparisons.
          </p>
        </div>
        <div className="pt-2">
          <button
            type="button"
            onClick={onAnalyzeTimeline}
            disabled={loadingTimeline}
            className="inline-flex items-center space-x-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium px-4 py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            {loadingTimeline ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Analyzing Signal Timeline...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Analyze Signal Timeline</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // Guard C: Insufficient longitudinal evidence detected
  if (!timelineResult.hasSufficientEvidence) {
    return (
      <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 text-stone-500" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h4 className="font-serif font-bold text-stone-900 text-base">
            Insufficient Longitudinal Evidence
          </h4>
          <p className="text-xs text-stone-600 leading-relaxed">
            Insufficient longitudinal evidence detected to establish a grounded Then vs Now comparison for this scope.
          </p>
          {timelineResult.message && (
            <p className="text-xs text-stone-500 bg-stone-100/80 p-3 rounded-xl border border-stone-200 text-left leading-relaxed">
              {timelineResult.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Guard D: Shifts array is empty
  if (!timelineResult.shifts || timelineResult.shifts.length === 0) {
    return (
      <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-stone-100 text-stone-600 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6 text-stone-400" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h4 className="font-serif font-bold text-stone-900 text-base">
            No Significant Shifts Identified
          </h4>
          <p className="text-xs text-stone-600 leading-relaxed">
            No significant perspective or reaction shifts were identified across the selected reflections.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id="then-vs-now-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Header Overview */}
      <div className="bg-gradient-to-br from-stone-50 via-stone-50/80 to-amber-50/40 border border-stone-200/90 rounded-2xl p-6 sm:p-7 space-y-2 relative overflow-hidden shadow-2xs">
        <div className="flex items-center space-x-2 text-amber-900">
          <div className="p-1.5 bg-amber-100/80 rounded-lg border border-amber-300/50">
            <Clock className="w-4 h-4 text-amber-800" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-950">
            Longitudinal Comparison
          </span>
        </div>
        <h3 className="text-lg sm:text-xl font-serif font-bold text-stone-900 tracking-tight">
          Then vs Now
        </h3>
        <p className="text-xs text-stone-600 max-w-2xl leading-relaxed">
          Side-by-side contrast of your recorded reactions, interpretations, and perspectives between earlier and later moments in time.
        </p>
      </div>

      {/* Comparison Cards Deck */}
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

          const formattedShiftType = shift.shiftType
            ? shift.shiftType.replace('_', ' ')
            : 'Perspective Shift';

          return (
            <div
              key={idx}
              className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xs"
            >
              {/* Card Header: Shift Type Badge & Date Span */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-800 bg-stone-100 px-2.5 py-0.5 rounded-md border border-stone-200/80">
                    {formattedShiftType}
                  </span>
                  <span className="text-xs font-semibold text-stone-900">
                    Shift {idx + 1}
                  </span>
                </div>
                {shift.earlierDate && shift.laterDate && (
                  <span className="text-[11px] text-stone-500 font-mono bg-stone-50 px-2.5 py-1 rounded-md border border-stone-200/70 inline-flex items-center space-x-1.5 self-start sm:self-auto">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    <span>{shift.earlierDate} → {shift.laterDate}</span>
                  </span>
                )}
              </div>

              {/* Main Comparison Area: 2 Columns (Desktop) / Stacking (Mobile) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* LEFT: THEN */}
                <div className="bg-stone-50/80 border border-stone-200/85 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-stone-500 font-medium border-b border-stone-200/60 pb-1.5">
                      <span className="inline-flex items-center space-x-1.5 uppercase tracking-wider text-[10px] font-bold text-stone-600">
                        <Clock className="w-3.5 h-3.5 text-stone-400" />
                        <span>THEN</span>
                      </span>
                      {shift.earlierDate && (
                        <span className="font-mono text-stone-400">{shift.earlierDate}</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-800 leading-relaxed font-serif pt-1">
                      {shift.earlierState}
                    </p>
                  </div>

                  {/* Earlier Evidence Pills */}
                  {earlierEvidence.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-stone-200/60">
                      <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider block">
                        Earlier Evidence:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {earlierEvidence.map((se, sIdx) => {
                          const isResolvable = targetEntries.some((e) => e.id === se.entryId);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleEvidenceClick(se.entryId)}
                              disabled={!isResolvable}
                              className={`inline-flex items-center space-x-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                                isResolvable
                                  ? 'bg-white hover:bg-stone-100 text-stone-800 border-stone-200/90 shadow-2xs cursor-pointer group focus-visible:ring-2 focus-visible:ring-amber-500'
                                  : 'bg-stone-100 text-stone-400 border-stone-200/50 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <Calendar className="w-3 h-3 text-stone-400" />
                              <span className="truncate max-w-[140px] font-medium">{se.title}</span>
                              {isResolvable && (
                                <ChevronRight className="w-3 h-3 text-stone-300 group-hover:text-stone-600" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: NOW */}
                <div className="bg-amber-50/40 border border-amber-200/70 rounded-xl p-4 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-amber-900 font-medium border-b border-amber-200/50 pb-1.5">
                      <span className="inline-flex items-center space-x-1.5 uppercase tracking-wider text-[10px] font-bold text-amber-900">
                        <ArrowRight className="w-3.5 h-3.5 text-amber-700" />
                        <span>NOW</span>
                      </span>
                      {shift.laterDate && (
                        <span className="font-mono text-amber-800/70">{shift.laterDate}</span>
                      )}
                    </div>
                    <p className="text-xs text-stone-900 leading-relaxed font-serif font-medium pt-1">
                      {shift.laterState}
                    </p>
                  </div>

                  {/* Later Evidence Pills */}
                  {laterEvidence.length > 0 && (
                    <div className="space-y-1.5 pt-2 border-t border-amber-200/50">
                      <span className="text-[10px] font-medium text-amber-800/80 uppercase tracking-wider block">
                        Later Evidence:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {laterEvidence.map((se, sIdx) => {
                          const isResolvable = targetEntries.some((e) => e.id === se.entryId);
                          return (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleEvidenceClick(se.entryId)}
                              disabled={!isResolvable}
                              className={`inline-flex items-center space-x-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all ${
                                isResolvable
                                  ? 'bg-white hover:bg-amber-50 text-stone-850 border-amber-200/90 shadow-2xs cursor-pointer group focus-visible:ring-2 focus-visible:ring-amber-500'
                                  : 'bg-stone-100 text-stone-400 border-stone-200/50 cursor-not-allowed opacity-60'
                              }`}
                            >
                              <Calendar className="w-3 h-3 text-amber-700/60" />
                              <span className="truncate max-w-[140px] font-medium">{se.title}</span>
                              {isResolvable && (
                                <ChevronRight className="w-3 h-3 text-amber-400 group-hover:text-amber-800" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Below Columns: WHAT CHANGED */}
              <div className="bg-stone-50/70 border border-stone-200/70 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  <span>What Changed</span>
                </div>
                <p className="text-xs text-stone-900 font-medium leading-relaxed">
                  {shift.observation}
                </p>
                {hasDistinctExplanation && (
                  <p className="text-xs text-stone-600 leading-relaxed pt-1 border-t border-stone-200/50">
                    <span className="font-semibold text-stone-700 mr-1">Context:</span>
                    {shift.explanation}
                  </p>
                )}

                {/* Context Evidence if present */}
                {contextEvidence.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
                    <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mr-1">
                      Context Reflections:
                    </span>
                    {contextEvidence.map((se, sIdx) => {
                      const isResolvable = targetEntries.some((e) => e.id === se.entryId);
                      return (
                        <button
                          key={sIdx}
                          type="button"
                          onClick={() => handleEvidenceClick(se.entryId)}
                          disabled={!isResolvable}
                          className={`inline-flex items-center space-x-1 text-[11px] px-2 py-1 rounded-md border transition-all ${
                            isResolvable
                              ? 'bg-white hover:bg-stone-100 text-stone-700 border-stone-200 cursor-pointer group focus-visible:ring-2 focus-visible:ring-amber-500'
                              : 'bg-stone-100 text-stone-400 border-stone-200/50 cursor-not-allowed opacity-60'
                          }`}
                        >
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span className="truncate max-w-[130px]">{se.title}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

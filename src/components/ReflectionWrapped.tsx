import React from 'react';
import {
  JournalEntry,
  CrossEntryAnalysisResult,
  SignalTimelineResult,
} from '../types';
import {
  Sparkles,
  Milestone,
  Calendar,
  ChevronRight,
  FileText,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Compass,
  Layers,
  Heart,
  Loader2,
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
  // Sort target entries chronologically for deterministic emotional arc
  const chronologicalEntries = [...targetEntries].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const handleOpenEntryById = (entryId: string) => {
    const found = targetEntries.find((e) => e.id === entryId);
    if (found) {
      onSelectEntry(found);
    }
  };

  // State 1: Fewer than 2 structured reflections
  if (targetEntries.length < 2) {
    return (
      <div className="bg-stone-50/80 border border-stone-200 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-800 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6 text-amber-700" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h4 className="font-serif font-bold text-stone-900 text-base">
            Reflection Wrapped Needs More Reflections
          </h4>
          <p className="text-xs text-stone-600 leading-relaxed">
            Reflection Wrapped synthesizes recurring patterns, emotional trajectories, and perspective shifts across your journal. You need at least 2 structured reflections in your active scope.
          </p>
        </div>
        <div className="inline-flex items-center space-x-2 text-xs text-stone-500 bg-white px-3.5 py-1.5 rounded-full border border-stone-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Currently available in active scope: {targetEntries.length} structured {targetEntries.length === 1 ? 'reflection' : 'reflections'}</span>
        </div>
      </div>
    );
  }

  // Check whether analyses have been run
  const hasPatterns = Boolean(patternsResult && patternsResult.hasSufficientEvidence && patternsResult.patterns?.length > 0);
  const hasTimeline = Boolean(timelineResult && timelineResult.hasSufficientEvidence && timelineResult.shifts?.length > 0);
  const isAnyAnalysisRun = Boolean(patternsResult || timelineResult);

  // Extract emotional & perspective shifts from existing timeline result
  const emotionalShifts = (timelineResult?.shifts || []).filter(
    (s) => s.shiftType === 'emotional_reaction' || s.shiftType === 'perspective'
  );

  return (
    <div id="reflection-wrapped-container" className="space-y-8 animate-in fade-in duration-200">
      {/* Header & Introduction */}
      <div className="bg-gradient-to-br from-amber-50/70 via-stone-50/80 to-stone-100/60 border border-amber-200/60 rounded-2xl p-6 sm:p-8 space-y-3 relative overflow-hidden shadow-2xs">
        <div className="flex items-center space-x-2 text-amber-800">
          <div className="p-2 bg-amber-100/70 rounded-xl border border-amber-300/60">
            <Compass className="w-5 h-5 text-amber-800" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-900/80">
            Longitudinal Synthesis
          </span>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">
            Reflection Wrapped
          </h3>
          <p className="text-xs sm:text-sm text-stone-600 max-w-2xl leading-relaxed">
            A grounded overview of your reflections across time. Every observation, recurring pattern, and perspective shift below is assembled directly from what you chose to record in your journal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-stone-500">
          <span className="inline-flex items-center space-x-1.5 bg-white/90 border border-stone-200/80 px-2.5 py-1 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-stone-400" />
            <span>
              {chronologicalEntries.length > 0 && `${chronologicalEntries[0].date} → ${chronologicalEntries[chronologicalEntries.length - 1].date}`}
            </span>
          </span>
          <span className="inline-flex items-center space-x-1.5 bg-white/90 border border-stone-200/80 px-2.5 py-1 rounded-lg">
            <FileText className="w-3.5 h-3.5 text-stone-400" />
            <span>{chronologicalEntries.length} Reflections Synthesized</span>
          </span>
          <span className="inline-flex items-center space-x-1.5 bg-white/90 border border-stone-200/80 px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50/50">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Non-Diagnostic & Grounded</span>
          </span>
        </div>
      </div>

      {/* If neither analysis has run yet, provide clear instruction and quick triggers */}
      {!isAnyAnalysisRun && (
        <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-6 sm:p-7 text-center space-y-4">
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center mx-auto">
            <Layers className="w-5 h-5" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h4 className="font-serif font-bold text-stone-800 text-sm">
              Generate Analysis for Current Scope
            </h4>
            <p className="text-xs text-stone-500 leading-relaxed">
              Reflection Wrapped assembles insights from your Recurring Patterns and Signal Timeline analysis. Generate them below to populate your full reflection summary.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              onClick={onAnalyzePatterns}
              disabled={loadingPatterns}
              className="inline-flex items-center space-x-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium px-4 py-2 rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              {loadingPatterns ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Patterns...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Analyze Recurring Patterns</span>
                </>
              )}
            </button>
            <button
              onClick={onAnalyzeTimeline}
              disabled={loadingTimeline}
              className="inline-flex items-center space-x-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-medium px-4 py-2 rounded-xl transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              {loadingTimeline ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Timeline...</span>
                </>
              ) : (
                <>
                  <Milestone className="w-3.5 h-3.5 text-amber-700" />
                  <span>Analyze Signal Timeline</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SECTION B: Emotional Arc */}
      <div id="wrapped-emotional-arc-section" className="space-y-4">
        <div className="flex items-center space-x-2 border-b border-stone-100 pb-2">
          <Heart className="w-4 h-4 text-rose-600" />
          <h4 className="font-serif font-bold text-stone-900 text-base">
            Emotional & Reaction Arc
          </h4>
        </div>
        <p className="text-xs text-stone-500 max-w-2xl leading-relaxed">
          How your expressed feelings and reactions developed across the chronological timeline of your reflections.
        </p>

        {/* Chronological Step Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
          {chronologicalEntries.map((entry, idx) => (
            <div
              key={entry.id}
              className="bg-white border border-stone-200/85 hover:border-stone-300 rounded-xl p-4 space-y-3 shadow-2xs transition-all flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-stone-400">
                  <span className="font-mono font-medium text-stone-500">Step {idx + 1}</span>
                  <span>{entry.date}</span>
                </div>
                <h5 className="font-medium text-stone-900 text-xs line-clamp-1">
                  {entry.title}
                </h5>
                {entry.summary?.emotionalTone && (
                  <div className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-md bg-stone-100 text-stone-700 text-[11px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    <span>Tone: {entry.summary.emotionalTone}</span>
                  </div>
                )}
                {entry.summary?.feelingOrReaction && (
                  <p className="text-xs text-stone-600 leading-relaxed bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                    <span className="font-medium text-stone-800 block text-[10px] uppercase tracking-wider mb-0.5">Reaction:</span>
                    {entry.summary.feelingOrReaction}
                  </p>
                )}
              </div>

              <button
                onClick={() => onSelectEntry(entry)}
                className="w-full inline-flex items-center justify-between text-xs text-stone-600 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 border border-stone-200/70 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-[11px]">View Reflection</span>
                <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
              </button>
            </div>
          ))}
        </div>

        {/* Highlighted Emotional Shifts if Timeline has been generated */}
        {emotionalShifts.length > 0 && (
          <div className="mt-4 bg-amber-50/40 border border-amber-200/50 rounded-xl p-4 space-y-3">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-amber-900">
              <TrendingUp className="w-4 h-4 text-amber-700" />
              <span>Grounded Emotional & Perspective Shifts Detected:</span>
            </div>
            <div className="space-y-2">
              {emotionalShifts.map((shift, sIdx) => (
                <div key={sIdx} className="bg-white p-3 rounded-lg border border-amber-100 text-xs space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                    <span className="font-medium text-stone-800">{shift.observation}</span>
                    {shift.earlierDate && shift.laterDate && (
                      <span className="text-stone-400">({shift.earlierDate} → {shift.laterDate})</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                    <div className="bg-stone-50 p-2 rounded border border-stone-100">
                      <span className="font-semibold text-stone-500 block text-[10px] uppercase">Earlier State:</span>
                      <span className="text-stone-700">{shift.earlierState}</span>
                    </div>
                    <div className="bg-amber-50/80 p-2 rounded border border-amber-200/60">
                      <span className="font-semibold text-amber-800 block text-[10px] uppercase">Later State:</span>
                      <span className="text-stone-800">{shift.laterState}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* SECTION C: Patterns That Kept Appearing */}
      <div id="wrapped-recurring-patterns-section" className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <h4 className="font-serif font-bold text-stone-900 text-base">
              Patterns That Kept Appearing
            </h4>
          </div>
          {!hasPatterns && !loadingPatterns && (
            <button
              onClick={onAnalyzePatterns}
              className="text-xs text-amber-850 hover:text-amber-950 font-medium underline underline-offset-2 cursor-pointer"
            >
              Analyze Patterns
            </button>
          )}
        </div>
        <p className="text-xs text-stone-500 max-w-2xl leading-relaxed">
          Themes, situational triggers, or reaction loops observed across multiple reflections.
        </p>

        {hasPatterns ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {patternsResult!.patterns.map((pattern, pIdx) => (
              <div
                key={pIdx}
                className="bg-white border border-stone-200/90 rounded-xl p-4 space-y-3 shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                      Pattern {pIdx + 1}
                    </span>
                    {pattern.evidenceStrength && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        pattern.evidenceStrength === 'strong'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : pattern.evidenceStrength === 'emerging'
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {pattern.evidenceStrength.charAt(0).toUpperCase() + pattern.evidenceStrength.slice(1)} Evidence
                      </span>
                    )}
                  </div>

                  <h5 className="font-semibold text-stone-900 text-sm leading-snug">
                    {pattern.observation}
                  </h5>

                  {pattern.explanation && (
                    <p className="text-xs text-stone-600 leading-relaxed bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                      {pattern.explanation}
                    </p>
                  )}
                </div>

                {/* Supporting Entry Pills */}
                {Array.isArray(pattern.supportingEntries) && pattern.supportingEntries.length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-stone-100">
                    <p className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                      Supporting Journal Entries:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {pattern.supportingEntries.map((se, sIdx) => (
                        <button
                          key={sIdx}
                          onClick={() => handleOpenEntryById(se.entryId)}
                          className="inline-flex items-center space-x-1 text-[11px] bg-stone-50 hover:bg-stone-100 text-stone-800 px-2 py-1 rounded-md border border-stone-200 transition-colors cursor-pointer group"
                        >
                          <Calendar className="w-3 h-3 text-stone-400 group-hover:text-stone-600" />
                          <span className="truncate max-w-[130px] font-medium">{se.title}</span>
                          <ChevronRight className="w-3 h-3 text-stone-300 group-hover:text-stone-600" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-stone-50/70 border border-dashed border-stone-200 rounded-xl p-5 text-center space-y-2">
            <p className="text-xs text-stone-500">
              {loadingPatterns
                ? 'Analyzing recurring patterns...'
                : 'Recurring pattern analysis has not yet been computed for this scope.'}
            </p>
            {!loadingPatterns && (
              <button
                onClick={onAnalyzePatterns}
                className="inline-flex items-center space-x-1.5 text-xs text-amber-800 hover:text-amber-950 font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                <span>Run Pattern Analysis</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* SECTION D: Biggest Perspective Shifts */}
      <div id="wrapped-perspective-shifts-section" className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
          <div className="flex items-center space-x-2">
            <Milestone className="w-4 h-4 text-amber-700" />
            <h4 className="font-serif font-bold text-stone-900 text-base">
              Biggest Perspective Shifts
            </h4>
          </div>
          {!hasTimeline && !loadingTimeline && (
            <button
              onClick={onAnalyzeTimeline}
              className="text-xs text-amber-850 hover:text-amber-950 font-medium underline underline-offset-2 cursor-pointer"
            >
              Analyze Timeline
            </button>
          )}
        </div>
        <p className="text-xs text-stone-500 max-w-2xl leading-relaxed">
          Documented shifts in your perspective, assumptions, interpretations, or internal focus across time.
        </p>

        {hasTimeline ? (
          <div className="space-y-3">
            {timelineResult!.shifts.map((shift, idx) => (
              <div
                key={idx}
                className="bg-white border border-stone-200/90 rounded-xl p-4 sm:p-5 space-y-3.5 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-700 bg-stone-100 px-2 py-0.5 rounded">
                      {shift.shiftType ? shift.shiftType.replace('_', ' ') : 'Perspective Shift'}
                    </span>
                    <span className="text-xs font-semibold text-stone-900">
                      {shift.observation}
                    </span>
                  </div>
                  {shift.earlierDate && shift.laterDate && (
                    <span className="text-[11px] text-stone-400 font-mono">
                      {shift.earlierDate} → {shift.laterDate}
                    </span>
                  )}
                </div>

                {/* Earlier State vs Later State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="bg-stone-50/80 border border-stone-200/80 rounded-xl p-3 space-y-1">
                    <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-stone-500">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>Earlier State</span>
                    </div>
                    <p className="text-xs text-stone-700 leading-relaxed font-serif">
                      {shift.earlierState}
                    </p>
                  </div>
                  <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3 space-y-1">
                    <div className="flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      <ArrowRight className="w-3 h-3 text-amber-700" />
                      <span>Later State</span>
                    </div>
                    <p className="text-xs text-stone-900 leading-relaxed font-serif font-medium">
                      {shift.laterState}
                    </p>
                  </div>
                </div>

                {shift.explanation && (
                  <p className="text-xs text-stone-600 leading-relaxed bg-stone-50/50 p-2.5 rounded-lg border border-stone-100">
                    <span className="font-medium text-stone-800 mr-1">Grounded Evidence:</span>
                    {shift.explanation}
                  </p>
                )}

                {/* Supporting Role-Tagged Evidence Pills */}
                {Array.isArray(shift.supportingEntries) && shift.supportingEntries.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider mr-1">
                      Evidence:
                    </span>
                    {shift.supportingEntries.map((se, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => handleOpenEntryById(se.entryId)}
                        className="inline-flex items-center space-x-1.5 text-[11px] bg-white hover:bg-stone-100 text-stone-800 px-2 py-1 rounded-md border border-stone-200 transition-colors cursor-pointer group shadow-2xs"
                      >
                        <Calendar className="w-3 h-3 text-stone-400 group-hover:text-stone-600" />
                        <span className="truncate max-w-[130px] font-medium">{se.title}</span>
                        {se.roleInShift === 'earlier_state' && (
                          <span className="text-[9px] bg-stone-100 text-stone-500 px-1 rounded">Earlier</span>
                        )}
                        {se.roleInShift === 'later_state' && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1 rounded">Later</span>
                        )}
                        <ChevronRight className="w-3 h-3 text-stone-300 group-hover:text-stone-600" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-stone-50/70 border border-dashed border-stone-200 rounded-xl p-5 text-center space-y-2">
            <p className="text-xs text-stone-500">
              {loadingTimeline
                ? 'Analyzing longitudinal perspective shifts...'
                : 'Signal Timeline analysis has not yet been computed for this scope.'}
            </p>
            {!loadingTimeline && (
              <button
                onClick={onAnalyzeTimeline}
                className="inline-flex items-center space-x-1.5 text-xs text-amber-800 hover:text-amber-950 font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg cursor-pointer transition-colors"
              >
                <Milestone className="w-3.5 h-3.5 text-amber-700" />
                <span>Run Timeline Analysis</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* SECTION E: Closing Grounding Note */}
      <div className="bg-stone-100/70 border border-stone-200/80 rounded-xl p-4 sm:p-5 text-center space-y-1.5">
        <p className="text-xs font-serif font-medium text-stone-800">
          “These aren’t conclusions about you. They’re patterns and shifts grounded in what you chose to write.”
        </p>
        <p className="text-[11px] text-stone-500">
          Reading the Signals is a thinking companion designed to assist your introspection, not evaluate your personality.
        </p>
      </div>
    </div>
  );
};

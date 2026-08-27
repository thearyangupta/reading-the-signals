import React, { useState } from 'react';
import { JournalEntry, CrossEntryAnalysisResult, CrossEntryPattern } from '../types';
import { auth } from '../lib/firebase';
import {
  Layers,
  Sparkles,
  AlertCircle,
  Loader2,
  Calendar,
  CheckCircle2,
  FileText,
  Info,
  RefreshCw,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface PatternAnalysisSectionProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
}

export const PatternAnalysisSection: React.FC<PatternAnalysisSectionProps> = ({
  entries,
  onSelectEntry,
}) => {
  const [analysisResult, setAnalysisResult] = useState<CrossEntryAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter entries that have a structured summary
  const structuredEntries = entries.filter((e) => Boolean(e.summary));

  const handleAnalyzePatterns = async () => {
    if (structuredEntries.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      // Obtain the current signed-in user's Firebase ID token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to analyze reflection patterns.');
      }
      const idToken = await currentUser.getIdToken();

      // Send only the relevant structured signals
      const payloadEntries = structuredEntries.map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title,
        situation: e.summary?.situation || e.situation || '',
        behaviorOrEvent: e.summary?.behaviorOrEvent || e.behaviorOrEvent || '',
        feelingOrReaction: e.summary?.feelingOrReaction || e.feelingOrReaction || '',
        importantContext: e.summary?.importantContext || e.importantContext || '',
        subjects: Array.isArray(e.summary?.subjects) ? e.summary.subjects : [],
        theme: e.summary?.theme || '',
        emotionalTone: e.summary?.emotionalTone || '',
        interpretation: e.summary?.interpretation || '',
      }));

      const res = await fetch('/api/patterns', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ entries: payloadEntries }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to surface recurring patterns.');
      }

      setAnalysisResult(data.result);
    } catch (err: any) {
      console.error('Pattern analysis error:', err);
      setError(err?.message || 'Unable to complete cross-entry pattern reasoning.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSupportingEntry = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId);
    if (target) {
      onSelectEntry(target);
    }
  };

  return (
    <div id="cross-entry-pattern-section" className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-800 border border-amber-200/50">
              <Layers className="w-4 h-4 text-amber-700" />
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 tracking-tight">
              Cross-Entry Pattern Observations
            </h3>
          </div>
          <p className="text-xs text-stone-500 max-w-xl leading-relaxed">
            Surfaces recurring situations, themes, and reactions across multiple journal reflections, strictly grounded in your explicit structured signals without clinical diagnosis or speculative mind-reading.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="analyze-cross-entry-patterns-btn"
            onClick={handleAnalyzePatterns}
            disabled={loading || structuredEntries.length < 2}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer ${
              structuredEntries.length < 2
                ? 'bg-stone-100 text-stone-400 border border-stone-200/60 cursor-not-allowed'
                : 'bg-stone-900 hover:bg-stone-800 text-white active:scale-98'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                <span>Analyzing Signals...</span>
              </>
            ) : analysisResult ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                <span>Re-Analyze Patterns</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Surface Patterns ({structuredEntries.length} entries)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notice & Eligibility status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-stone-50/80 px-3.5 py-2.5 rounded-xl border border-stone-200/60">
        <div className="flex items-center space-x-2 text-stone-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>{structuredEntries.length}</strong> of {entries.length} {entries.length === 1 ? 'entry' : 'entries'} have structured summaries.
          </span>
        </div>
        <span className="text-[11px] text-stone-400">
          {structuredEntries.length >= 2
            ? '✓ Eligible for multi-entry pattern reasoning'
            : 'At least 2 structured summaries required'}
        </span>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start justify-between gap-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Pattern Reasoning Error</p>
              <p className="text-red-600 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            onClick={handleAnalyzePatterns}
            className="text-red-700 hover:text-red-900 font-medium underline text-xs cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content Display */}
      {loading ? (
        <div className="py-12 text-center space-y-3">
          <Loader2 className="w-7 h-7 animate-spin text-stone-600 mx-auto" />
          <p className="text-xs text-stone-600 font-medium font-serif">
            Synthesizing structured signals across your reflections...
          </p>
          <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
            Checking for recurring observations supported by at least 2 entries with explicit evidence.
          </p>
        </div>
      ) : analysisResult ? (
        <div className="space-y-4">
          {/* Summary message */}
          {analysisResult.message && (
            <div className="text-xs text-stone-700 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 flex items-start space-x-2">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{analysisResult.message}</p>
            </div>
          )}

          {/* Insufficient Evidence State */}
          {!analysisResult.hasSufficientEvidence || analysisResult.patterns.length === 0 ? (
            <div className="text-center py-8 px-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-2">
              <CheckCircle2 className="w-6 h-6 text-stone-400 mx-auto" />
              <h4 className="text-xs font-serif font-semibold text-stone-700">
                No Recurring Patterns Supported Yet
              </h4>
              <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                The reasoning engine requires multiple distinct entries with consistent explicit evidence before surfacing a pattern. Continue journaling to build a richer longitudinal signal set.
              </p>
            </div>
          ) : (
            /* Patterns List */
            <div className="grid grid-cols-1 gap-3.5">
              {analysisResult.patterns.map((pat: CrossEntryPattern, idx: number) => (
                <div
                  key={idx}
                  id={`pattern-card-${idx}`}
                  className="bg-[#FCFCFA] border border-stone-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3 hover:border-stone-300 transition-colors"
                >
                  {/* Pattern Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 border border-amber-200/60 px-2 py-0.5 rounded-md">
                          Observation {idx + 1}
                        </span>
                        <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                          Supported across {pat.evidenceCount} {pat.evidenceCount === 1 ? 'entry' : 'entries'}
                        </span>
                      </div>
                      <h4 className="text-sm font-semibold text-stone-900 pt-0.5">
                        {pat.observation}
                      </h4>
                    </div>
                  </div>

                  {/* Grounded Explanation */}
                  <div className="bg-white p-3 rounded-lg border border-stone-100 text-xs text-stone-700 leading-relaxed">
                    <span className="font-medium text-stone-900 mr-1.5">Grounded Evidence:</span>
                    {pat.explanation}
                  </div>

                  {/* Supporting Entries List */}
                  {Array.isArray(pat.supportingEntries) && pat.supportingEntries.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] font-medium text-stone-500 flex items-center space-x-1">
                        <FileText className="w-3 h-3 text-stone-400" />
                        <span>Supporting Journal Entries:</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {pat.supportingEntries.map((se, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={() => handleOpenSupportingEntry(se.entryId)}
                            className="inline-flex items-center space-x-1.5 text-xs bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 px-2.5 py-1 rounded-lg transition-colors cursor-pointer group"
                            title="Click to view entry"
                          >
                            <Calendar className="w-3 h-3 text-stone-400 group-hover:text-stone-600" />
                            <span className="font-medium truncate max-w-[160px] sm:max-w-[220px]">
                              {se.title}
                            </span>
                            {se.date && <span className="text-[10px] text-stone-400">({se.date})</span>}
                            <ChevronRight className="w-3 h-3 text-stone-300 group-hover:text-stone-600" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Initial prompt / call to action */
        <div className="bg-stone-50/50 border border-dashed border-stone-200 rounded-xl p-6 text-center space-y-2">
          <Sparkles className="w-5 h-5 text-amber-600/70 mx-auto" />
          <h4 className="text-xs font-serif font-semibold text-stone-800">
            Discover Cross-Entry Recurring Observations
          </h4>
          <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
            When you have at least 2 entries with structured summaries, you can examine what situations, themes, or reactions recur over time.
          </p>
        </div>
      )}
    </div>
  );
};

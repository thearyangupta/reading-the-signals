import React, { useState, useEffect, useRef } from 'react';
import {
  JournalEntry,
  CrossEntryAnalysisResult,
  CrossEntryPattern,
  CrossEntryContradictionResult,
  CrossEntryContradiction,
  SignalTimelineResult,
  SignalTimelineShift,
  AskJournalResult,
} from '../types';
import { auth } from '../lib/firebase';
import { ReflectionWrapped } from './ReflectionWrapped';
import { ThenVsNowComparison } from './ThenVsNowComparison';
import { AskMyJournal } from './AskMyJournal';
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
  Compass,
  HelpCircle,
  Split,
  Milestone,
  ArrowRight,
  Clock,
  TrendingUp,
  Filter,
  CheckSquare,
  Square,
  X,
  MessageSquareQuote,
} from 'lucide-react';

interface PatternAnalysisSectionProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
}

export const PatternAnalysisSection: React.FC<PatternAnalysisSectionProps> = ({
  entries,
  onSelectEntry,
}) => {
  const [activeTab, setActiveTab] = useState<'patterns' | 'contradictions' | 'timeline' | 'wrapped' | 'then_now' | 'ask_journal'>('patterns');

  // Day 5 Patterns State
  const [patternsResult, setPatternsResult] = useState<CrossEntryAnalysisResult | null>(null);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);

  // Day 6 Contradictions State
  const [contradictionsResult, setContradictionsResult] = useState<CrossEntryContradictionResult | null>(null);
  const [loadingContradictions, setLoadingContradictions] = useState(false);
  const [contradictionsError, setContradictionsError] = useState<string | null>(null);

  // Signal Timeline State
  const [timelineResult, setTimelineResult] = useState<SignalTimelineResult | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Ask My Journal State
  const [askJournalQuestion, setAskJournalQuestion] = useState<string>('');
  const [askJournalResult, setAskJournalResult] = useState<AskJournalResult | null>(null);
  const [loadingAskJournal, setLoadingAskJournal] = useState(false);
  const [askJournalError, setAskJournalError] = useState<string | null>(null);
  const askRequestIdRef = useRef<number>(0);

  // Filter entries that have a structured summary
  const structuredEntries = entries.filter((e) => Boolean(e.summary));

  // Analysis Scope State (Shared across tabs)
  const [scopeMode, setScopeMode] = useState<'all' | 'selected'>('all');
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [draftSelectedEntryIds, setDraftSelectedEntryIds] = useState<string[]>([]);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);

  // Active target entries for analysis based on scope
  const targetEntries =
    scopeMode === 'all'
      ? structuredEntries
      : structuredEntries.filter((e) => selectedEntryIds.includes(e.id));

  // Multi-entry reasoning requirement for patterns, contradictions, and timeline
  const isMultiEntryScopeValid = targetEntries.length >= 2;

  // Deterministic effective scope key based on exact sorted target entry IDs
  const currentScopeKey = JSON.stringify(targetEntries.map((e) => e.id).sort());
  const prevScopeKeyRef = useRef<string>(currentScopeKey);

  // Invalidate analysis results, errors, and in-flight requests whenever the effective target entry set changes
  useEffect(() => {
    if (prevScopeKeyRef.current !== currentScopeKey) {
      prevScopeKeyRef.current = currentScopeKey;
      askRequestIdRef.current += 1;
      setPatternsResult(null);
      setContradictionsResult(null);
      setTimelineResult(null);
      setAskJournalResult(null);
      setPatternsError(null);
      setContradictionsError(null);
      setTimelineError(null);
      setAskJournalError(null);
      setLoadingAskJournal(false);
    }
  }, [currentScopeKey]);

  // Scope handlers
  const handleOpenScopeModal = () => {
    if (scopeMode === 'selected' && selectedEntryIds.length > 0) {
      setDraftSelectedEntryIds([...selectedEntryIds]);
    } else {
      setDraftSelectedEntryIds(
        selectedEntryIds.length > 0
          ? [...selectedEntryIds]
          : structuredEntries.map((e) => e.id)
      );
    }
    setIsScopeModalOpen(true);
  };

  const handleToggleDraftSelection = (id: string) => {
    setDraftSelectedEntryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDraftScope = () => {
    setDraftSelectedEntryIds(structuredEntries.map((e) => e.id));
  };

  const handleClearDraftScopeSelection = () => {
    setDraftSelectedEntryIds([]);
  };

  const handleResetToAll = () => {
    setScopeMode('all');
    setIsScopeModalOpen(false);
  };

  const handleSwitchToSelectedScope = () => {
    if (scopeMode === 'all') {
      if (selectedEntryIds.length > 0) {
        setScopeMode('selected');
      } else {
        handleOpenScopeModal();
      }
    } else {
      handleOpenScopeModal();
    }
  };

  const handleApplyScope = () => {
    if (draftSelectedEntryIds.length === 0) return;
    setSelectedEntryIds([...draftSelectedEntryIds]);
    setScopeMode('selected');
    setIsScopeModalOpen(false);
  };

  const handleCloseScopeModal = () => {
    setIsScopeModalOpen(false);
  };

  const handleAnalyzePatterns = async () => {
    if (targetEntries.length < 2) return;

    const requestScopeKey = currentScopeKey;
    setLoadingPatterns(true);
    setPatternsError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to analyze reflection patterns.');
      }
      const idToken = await currentUser.getIdToken();

      const payloadEntries = targetEntries.map((e) => ({
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
        throw new Error(data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || 'Failed to surface recurring patterns.'));
      }

      // Race-protection: only commit result if active scope key has not changed during request
      if (prevScopeKeyRef.current === requestScopeKey) {
        setPatternsResult(data.result);
      }
    } catch (err: any) {
      console.error('Pattern analysis error:', err);
      if (prevScopeKeyRef.current === requestScopeKey) {
        setPatternsError(err?.message || 'Unable to complete cross-entry pattern reasoning.');
      }
    } finally {
      if (prevScopeKeyRef.current === requestScopeKey) {
        setLoadingPatterns(false);
      }
    }
  };

  const handleAnalyzeContradictions = async () => {
    if (targetEntries.length < 2) return;

    const requestScopeKey = currentScopeKey;
    setLoadingContradictions(true);
    setContradictionsError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to analyze perspective differences.');
      }
      const idToken = await currentUser.getIdToken();

      const payloadEntries = targetEntries.map((e) => ({
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

      const res = await fetch('/api/contradictions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ entries: payloadEntries }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || 'Failed to analyze perspective differences.'));
      }

      // Race-protection: only commit result if active scope key has not changed during request
      if (prevScopeKeyRef.current === requestScopeKey) {
        setContradictionsResult(data.result);
      }
    } catch (err: any) {
      console.error('Contradiction analysis error:', err);
      if (prevScopeKeyRef.current === requestScopeKey) {
        setContradictionsError(err?.message || 'Unable to complete contradiction and perspective difference reasoning.');
      }
    } finally {
      if (prevScopeKeyRef.current === requestScopeKey) {
        setLoadingContradictions(false);
      }
    }
  };

  const handleAnalyzeTimeline = async () => {
    if (targetEntries.length < 2) return;

    const requestScopeKey = currentScopeKey;
    setLoadingTimeline(true);
    setTimelineError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to analyze signal timeline.');
      }
      const idToken = await currentUser.getIdToken();

      const payloadEntries = targetEntries.map((e) => ({
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

      const res = await fetch('/api/timeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ entries: payloadEntries }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || 'Failed to analyze signal timeline.'));
      }

      // Race-protection: only commit result if active scope key has not changed during request
      if (prevScopeKeyRef.current === requestScopeKey) {
        setTimelineResult(data.result);
      }
    } catch (err: any) {
      console.error('Signal timeline error:', err);
      if (prevScopeKeyRef.current === requestScopeKey) {
        setTimelineError(err?.message || 'Unable to complete signal timeline reasoning.');
      }
    } finally {
      if (prevScopeKeyRef.current === requestScopeKey) {
        setLoadingTimeline(false);
      }
    }
  };

  const handleAskJournal = async () => {
    if (targetEntries.length === 0) {
      setAskJournalError('Ask My Journal requires at least 1 structured reflection in the active scope.');
      return;
    }
    const trimmedQuestion = askJournalQuestion.trim();
    if (trimmedQuestion.length < 3) {
      setAskJournalError('Please enter a question with at least 3 characters.');
      return;
    }
    if (trimmedQuestion.length > 500) {
      setAskJournalError('Question exceeds maximum length of 500 characters.');
      return;
    }

    const requestScopeKey = currentScopeKey;
    const currentRequestId = ++askRequestIdRef.current;

    setLoadingAskJournal(true);
    setAskJournalError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Please sign in to ask questions about your reflections.');
      }
      const idToken = await currentUser.getIdToken();

      const payloadEntries = targetEntries.map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title,
        summary: e.summary,
      }));

      const res = await fetch('/api/ask-journal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          question: trimmedQuestion,
          entries: payloadEntries,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || 'Failed to process journal question.'));
      }

      // Race-protection: only commit result if active scope key has not changed and requestId is latest
      if (prevScopeKeyRef.current === requestScopeKey && askRequestIdRef.current === currentRequestId) {
        setAskJournalResult(data.result);
      }
    } catch (err: any) {
      console.error('Ask My Journal error:', err);
      if (prevScopeKeyRef.current === requestScopeKey && askRequestIdRef.current === currentRequestId) {
        setAskJournalError(err?.message || 'Unable to process question across journal entries.');
      }
    } finally {
      if (prevScopeKeyRef.current === requestScopeKey && askRequestIdRef.current === currentRequestId) {
        setLoadingAskJournal(false);
      }
    }
  };

  const handleOpenSupportingEntry = (entryId: string) => {
    const target = entries.find((e) => e.id === entryId);
    if (target) {
      onSelectEntry(target);
    }
  };

  const formatShiftTypeLabel = (type: string) => {
    switch (type) {
      case 'perspective':
        return 'Perspective Shift';
      case 'emotional_reaction':
        return 'Emotional Tone Shift';
      case 'interpretation':
        return 'Interpretation Shift';
      case 'focus':
        return 'Focus & Agency Shift';
      default:
        return 'Perspective Shift';
    }
  };

  return (
    <div id="cross-entry-analysis-section" className="bg-white border border-stone-200/90 rounded-2xl p-5 sm:p-7 shadow-xs space-y-6">
      {/* Top Header with Navigation Tabs */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-stone-100 pb-4">
        <div className="space-y-1 min-w-0 max-w-xl">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-800 border border-amber-200/50">
              <Layers className="w-4 h-4 text-amber-700" />
            </div>
            <h3 className="text-base sm:text-lg font-serif font-bold text-stone-900 tracking-tight">
              Cross-Entry Signal Reasoning
            </h3>
          </div>
          <p className="text-xs text-stone-500 leading-relaxed">
            Multi-entry reasoning grounded strictly in your explicit structured reflections without speculative judgment or third-party assumptions.
          </p>
        </div>

        {/* Tab Toggle - Responsive multi-row wrap / grid layout */}
        <div className="p-1 bg-stone-100/80 rounded-xl border border-stone-200/60 w-full xl:w-auto overflow-hidden">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:flex xl:flex-wrap gap-1 w-full">
            <button
              id="tab-recurring-patterns-btn"
              onClick={() => setActiveTab('patterns')}
              className={`flex items-center justify-center sm:justify-start space-x-1.5 px-3 py-2 xl:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'patterns'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Recurring Patterns</span>
            </button>
            <button
              id="tab-perspective-differences-btn"
              onClick={() => setActiveTab('contradictions')}
              className={`flex items-center justify-center sm:justify-start space-x-1.5 px-3 py-2 xl:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'contradictions'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
            >
              <Split className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Perspective Differences</span>
            </button>
            <button
              id="tab-signal-timeline-btn"
              onClick={() => setActiveTab('timeline')}
              className={`flex items-center justify-center sm:justify-start space-x-1.5 px-3 py-2 xl:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'timeline'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
            >
              <Milestone className="w-3.5 h-3.5 text-amber-800 shrink-0" />
              <span>Signal Timeline</span>
            </button>
            <button
              id="tab-reflection-wrapped-btn"
              onClick={() => setActiveTab('wrapped')}
              className={`flex items-center justify-center sm:justify-start space-x-1.5 px-3 py-2 xl:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'wrapped'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-amber-900 shrink-0" />
              <span>Reflection Wrapped</span>
            </button>
            <button
              id="tab-then-vs-now-btn"
              onClick={() => setActiveTab('then_now')}
              className={`flex items-center justify-center sm:justify-start space-x-1.5 px-3 py-2 xl:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'then_now'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
            >
              <Clock className="w-3.5 h-3.5 text-amber-800 shrink-0" />
              <span>Then vs Now</span>
            </button>
            <button
              id="tab-ask-my-journal-btn"
              onClick={() => setActiveTab('ask_journal')}
              className={`flex items-center justify-center sm:justify-start space-x-1.5 px-3 py-2 xl:py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'ask_journal'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-500 hover:text-stone-800 hover:bg-stone-200/50'
              }`}
            >
              <MessageSquareQuote className="w-3.5 h-3.5 text-amber-800 shrink-0" />
              <span>Ask My Journal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Structured Signal Eligibility & Analysis Scope Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-stone-50/90 px-3.5 py-3 rounded-xl border border-stone-200/70 shadow-2xs">
        <div className="flex items-center space-x-2 text-stone-600 flex-wrap gap-y-1">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            <strong>{structuredEntries.length}</strong> of {entries.length} {entries.length === 1 ? 'entry' : 'entries'} have structured summaries.
          </span>
          <span className="text-stone-300 hidden sm:inline">•</span>
          <span className="text-[11px] text-stone-500">
            Analyzing: <strong className="text-stone-800">{targetEntries.length} {targetEntries.length === 1 ? 'entry' : 'entries'}</strong> ({scopeMode === 'all' ? 'All eligible' : 'Custom selection'})
          </span>
        </div>

        {/* Scope Selector Control */}
        <div className="flex items-center space-x-2 shrink-0 self-start sm:self-auto">
          <div className="inline-flex rounded-lg bg-stone-200/70 p-0.5 border border-stone-300/60">
            <button
              id="scope-all-btn"
              onClick={handleResetToAll}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                scopeMode === 'all'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              All entries ({structuredEntries.length})
            </button>
            <button
              id="scope-selected-btn"
              onClick={handleSwitchToSelectedScope}
              className={`flex items-center space-x-1 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                scopeMode === 'selected'
                  ? 'bg-white text-stone-900 shadow-2xs font-semibold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Filter className="w-3 h-3 text-amber-700" />
              <span>Selected ({selectedEntryIds.length})</span>
            </button>
          </div>

          {scopeMode === 'selected' && (
            <button
              id="open-scope-selector-modal-btn"
              onClick={handleOpenScopeModal}
              className="text-[11px] text-amber-800 hover:text-amber-950 font-medium underline underline-offset-2 cursor-pointer"
            >
              Edit scope
            </button>
          )}
        </div>
      </div>

      {targetEntries.length < 2 && activeTab !== 'ask_journal' && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              {targetEntries.length === 0
                ? 'Select at least 1 reflection to analyze in active scope.'
                : `Cross-entry reasoning requires at least 2 reflections (${targetEntries.length} currently selected).`}
            </span>
          </div>
          {scopeMode === 'selected' && (
            <button
              onClick={handleOpenScopeModal}
              className="text-amber-900 font-semibold underline text-xs cursor-pointer shrink-0"
            >
              Select Reflections
            </button>
          )}
        </div>
      )}

      {targetEntries.length === 0 && activeTab === 'ask_journal' && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Select at least 1 reflection to ask questions about your journal.
            </span>
          </div>
          {scopeMode === 'selected' && (
            <button
              onClick={handleOpenScopeModal}
              className="text-amber-900 font-semibold underline text-xs cursor-pointer shrink-0"
            >
              Select Reflections
            </button>
          )}
        </div>
      )}

      {/* Scope Selection Modal */}
      {isScopeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-stone-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-amber-700" />
                <h3 className="font-serif font-bold text-stone-900 text-sm">
                  Select Reflections for Cross-Entry Analysis
                </h3>
              </div>
              <button
                onClick={handleCloseScopeModal}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between text-xs text-stone-600">
              <span>
                Selected: <strong className="text-stone-900">{draftSelectedEntryIds.length}</strong> of {structuredEntries.length} reflections
              </span>
              <div className="space-x-2">
                <button
                  onClick={handleSelectAllDraftScope}
                  className="text-amber-800 hover:text-amber-950 font-medium underline text-[11px] cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-stone-300">|</span>
                <button
                  onClick={handleClearDraftScopeSelection}
                  className="text-stone-500 hover:text-stone-800 underline text-[11px] cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 divide-y divide-stone-100">
              {structuredEntries.length === 0 ? (
                <div className="py-6 text-center text-xs text-stone-400">
                  No structured reflections available yet.
                </div>
              ) : (
                structuredEntries.map((entry) => {
                  const isChecked = draftSelectedEntryIds.includes(entry.id);
                  return (
                    <label
                      key={entry.id}
                      className="flex items-start space-x-3 pt-2.5 pb-1 cursor-pointer hover:bg-stone-50/80 p-2 rounded-xl transition-colors group"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDraftSelection(entry.id)}
                        className="mt-0.5 rounded border-stone-300 text-amber-700 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium text-stone-900 truncate group-hover:text-amber-950">
                            {entry.title || 'Untitled Reflection'}
                          </p>
                          <span className="text-[10px] text-stone-400 shrink-0 font-mono">
                            {entry.date}
                          </span>
                        </div>
                        {entry.summary?.theme && (
                          <p className="text-[11px] text-stone-500 truncate mt-0.5">
                            Theme: {entry.summary.theme}
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>

            <div className="p-3.5 border-t border-stone-100 bg-stone-50 flex items-center justify-between">
              <span className="text-[11px] text-stone-500">
                {draftSelectedEntryIds.length === 0 ? (
                  <span className="text-amber-700 font-medium">Select at least 1 reflection</span>
                ) : draftSelectedEntryIds.length === 1 ? (
                  <span className="text-emerald-700 font-medium">✓ 1 reflection selected</span>
                ) : (
                  <span className="text-emerald-700 font-medium">✓ Ready for cross-entry analysis ({draftSelectedEntryIds.length})</span>
                )}
              </span>
              <div className="space-x-2">
                <button
                  onClick={handleResetToAll}
                  className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:text-stone-800 bg-white border border-stone-200 cursor-pointer"
                >
                  Reset to All
                </button>
                <button
                  id="apply-scope-modal-btn"
                  onClick={handleApplyScope}
                  disabled={draftSelectedEntryIds.length === 0}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium text-white transition-all cursor-pointer ${
                    draftSelectedEntryIds.length === 0
                      ? 'bg-stone-300 cursor-not-allowed'
                      : 'bg-stone-900 hover:bg-stone-800'
                  }`}
                >
                  Apply Scope ({draftSelectedEntryIds.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: RECURRING PATTERNS (DAY 5) */}
      {activeTab === 'patterns' && (
        <div id="recurring-patterns-tab-content" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCFCFA] p-3.5 rounded-xl border border-stone-200/70">
            <div>
              <h4 className="text-xs font-serif font-bold text-stone-900">
                Pattern Observations
              </h4>
              <p className="text-[11px] text-stone-500">
                Behavior and reaction patterns across multiple reflections.
              </p>
            </div>
            <button
              id="analyze-cross-entry-patterns-btn"
              onClick={handleAnalyzePatterns}
              disabled={loadingPatterns || !isMultiEntryScopeValid}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer shrink-0 ${
                !isMultiEntryScopeValid
                  ? 'bg-stone-100 text-stone-400 border border-stone-200/60 cursor-not-allowed'
                  : 'bg-stone-900 hover:bg-stone-800 text-white active:scale-98'
              }`}
            >
              {loadingPatterns ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Analyzing Patterns...</span>
                </>
              ) : patternsResult ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                  <span>Re-Analyze Patterns ({targetEntries.length})</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Surface Patterns ({targetEntries.length} {targetEntries.length === 1 ? 'entry' : 'entries'})</span>
                </>
              )}
            </button>
          </div>

          {/* Patterns Error State */}
          {patternsError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Pattern Reasoning Error</p>
                  <p className="text-red-600 mt-0.5">{patternsError}</p>
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

          {/* Patterns Content */}
          {loadingPatterns ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-stone-600 mx-auto" />
              <p className="text-xs text-stone-600 font-medium font-serif">
                Synthesizing structured signals across your reflections...
              </p>
              <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                Checking for recurring observations supported by at least 2 entries with verified citations.
              </p>
            </div>
          ) : patternsResult ? (
            <div className="space-y-4">
              {patternsResult.message && (
                <div className="text-xs text-stone-700 bg-amber-50/50 p-3 rounded-xl border border-amber-200/60 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{patternsResult.message}</p>
                </div>
              )}

              {!patternsResult.hasSufficientEvidence || patternsResult.patterns.length === 0 ? (
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
                <div className="grid grid-cols-1 gap-3.5">
                  {patternsResult.patterns.map((pat: CrossEntryPattern, idx: number) => (
                    <div
                      key={idx}
                      id={`pattern-card-${idx}`}
                      className="bg-[#FCFCFA] border border-stone-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-3 hover:border-stone-300 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100/70 border border-amber-200/60 px-2 py-0.5 rounded-md">
                              Observation {idx + 1}
                            </span>
                            <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                              Supported across {pat.evidenceCount} {pat.evidenceCount === 1 ? 'entry' : 'entries'}
                            </span>
                            {(pat.evidenceStrength === 'thin' || pat.evidenceCount === 2) && (
                              <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md">
                                Thin evidence
                              </span>
                            )}
                            {(pat.evidenceStrength === 'emerging' || pat.evidenceCount === 3) && (
                              <span className="text-[11px] font-medium text-stone-700 bg-stone-100 border border-stone-200/70 px-2 py-0.5 rounded-md">
                                Emerging evidence
                              </span>
                            )}
                            {(pat.evidenceStrength === 'strong' || pat.evidenceCount >= 4) && (
                              <span className="text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-md">
                                Strong evidence
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-semibold text-stone-900 pt-0.5">
                            {pat.observation}
                          </h4>
                        </div>
                      </div>

                      {(pat.evidenceStrength === 'thin' || pat.evidenceCount === 2) && (
                        <div className="text-[11px] text-amber-850 bg-amber-50/60 border border-amber-200/60 px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5">
                          <Info className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                          <span>Early signal — supported by only 2 journal entries.</span>
                        </div>
                      )}

                      <div className="bg-white p-3 rounded-lg border border-stone-100 text-xs text-stone-700 leading-relaxed">
                        <span className="font-medium text-stone-900 mr-1.5">Grounded Evidence:</span>
                        {pat.explanation}
                      </div>

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
            <div className="bg-stone-50/50 border border-dashed border-stone-200 rounded-xl p-6 text-center space-y-2">
              <Sparkles className="w-5 h-5 text-amber-600/70 mx-auto" />
              <h4 className="text-xs font-serif font-semibold text-stone-800">
                Discover Cross-Entry Recurring Observations
              </h4>
              <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                Examine recurring situations, themes, or reactions across multiple reflections with verified citations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PERSPECTIVE DIFFERENCES & CONTRADICTIONS (DAY 6) */}
      {activeTab === 'contradictions' && (
        <div id="perspective-differences-tab-content" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCFCFA] p-3.5 rounded-xl border border-stone-200/70">
            <div>
              <h4 className="text-xs font-serif font-bold text-stone-900">
                Grounded Perspective Differences
              </h4>
              <p className="text-[11px] text-stone-500">
                Contrasting perspectives across different moments.
              </p>
            </div>
            <button
              id="analyze-cross-entry-contradictions-btn"
              onClick={handleAnalyzeContradictions}
              disabled={loadingContradictions || !isMultiEntryScopeValid}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer shrink-0 ${
                !isMultiEntryScopeValid
                  ? 'bg-stone-100 text-stone-400 border border-stone-200/60 cursor-not-allowed'
                  : 'bg-stone-900 hover:bg-stone-800 text-white active:scale-98'
              }`}
            >
              {loadingContradictions ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Comparing Perspectives...</span>
                </>
              ) : contradictionsResult ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                  <span>Re-Analyze Differences ({targetEntries.length})</span>
                </>
              ) : (
                <>
                  <Split className="w-3.5 h-3.5 text-amber-300" />
                  <span>Explore Differences ({targetEntries.length} {targetEntries.length === 1 ? 'entry' : 'entries'})</span>
                </>
              )}
            </button>
          </div>

          {/* Contradictions Error State */}
          {contradictionsError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Perspective Comparison Error</p>
                  <p className="text-red-600 mt-0.5">{contradictionsError}</p>
                </div>
              </div>
              <button
                onClick={handleAnalyzeContradictions}
                className="text-red-700 hover:text-red-900 font-medium underline text-xs cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Contradictions Content */}
          {loadingContradictions ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-stone-600 mx-auto" />
              <p className="text-xs text-stone-600 font-medium font-serif">
                Comparing similar reflection contexts for perspective differences...
              </p>
              <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                Carefully identifying instances where similar situations met differing expressed interpretations or feelings.
              </p>
            </div>
          ) : contradictionsResult ? (
            <div className="space-y-4">
              {contradictionsResult.message && (
                <div className="text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200/70 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{contradictionsResult.message}</p>
                </div>
              )}

              {!contradictionsResult.hasSufficientEvidence || contradictionsResult.contradictions.length === 0 ? (
                <div className="text-center py-8 px-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-2">
                  <CheckCircle2 className="w-6 h-6 text-stone-400 mx-auto" />
                  <h4 className="text-xs font-serif font-semibold text-stone-700">
                    No Perspective Contradictions Identified
                  </h4>
                  <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                    Across your supplied reflections, your stated reactions and interpretations in similar situations appear consistent, or more comparative entries are needed before differences can be observed.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {contradictionsResult.contradictions.map((contra: CrossEntryContradiction, idx: number) => (
                    <div
                      key={idx}
                      id={`contradiction-card-${idx}`}
                      className="bg-[#FCFCFA] border border-stone-200/90 rounded-xl p-4 sm:p-5 shadow-2xs space-y-4 hover:border-stone-300 transition-colors"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[11px] font-semibold text-stone-800 bg-stone-200/70 border border-stone-300/60 px-2 py-0.5 rounded-md">
                              Perspective Difference {idx + 1}
                            </span>
                            <span className="text-[11px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md">
                              Compared across {contra.evidenceCount} {contra.evidenceCount === 1 ? 'entry' : 'entries'}
                            </span>
                          </div>
                          <h4 className="text-sm font-semibold text-stone-900 pt-0.5">
                            {contra.observation}
                          </h4>
                        </div>
                      </div>

                      {/* Grounded Evidence Breakdown */}
                      <div className="bg-white p-3.5 rounded-lg border border-stone-100 text-xs text-stone-700 leading-relaxed">
                        <span className="font-medium text-stone-900 mr-1.5">Observed Contrast:</span>
                        {contra.explanation}
                      </div>

                      {/* Supporting Entries List */}
                      {Array.isArray(contra.supportingEntries) && contra.supportingEntries.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-medium text-stone-500 flex items-center space-x-1">
                            <FileText className="w-3 h-3 text-stone-400" />
                            <span>Compared Journal Reflections:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {contra.supportingEntries.map((se, sIdx) => (
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

                      {/* Exactly ONE Clarifying Reflection Question Box */}
                      {contra.clarifyingQuestion && (
                        <div className="bg-amber-50/60 border border-amber-200/80 rounded-xl p-3.5 sm:p-4 space-y-1.5">
                          <div className="flex items-center space-x-2 text-amber-900 font-medium text-xs">
                            <Compass className="w-4 h-4 text-amber-700 shrink-0" />
                            <span className="font-serif font-bold">Reflection Question</span>
                          </div>
                          <p className="text-xs text-stone-800 font-medium leading-relaxed pl-6">
                            "{contra.clarifyingQuestion}"
                          </p>
                          <p className="text-[10px] text-stone-500 pl-6">
                            Consider exploring what felt different or what values were at play in each moment.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-stone-50/50 border border-dashed border-stone-200 rounded-xl p-6 text-center space-y-2">
              <HelpCircle className="w-5 h-5 text-stone-500/70 mx-auto" />
              <h4 className="text-xs font-serif font-semibold text-stone-800">
                Examine Contrasts in Reactions & Interpretations
              </h4>
              <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                When you have multiple reflections with structured summaries, the system can gently surface subtle variations in how you interpreted similar situations.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SIGNAL TIMELINE (PERSPECTIVE CHANGE OVER TIME) */}
      {activeTab === 'timeline' && (
        <div id="signal-timeline-tab-content" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#FCFCFA] p-3.5 rounded-xl border border-stone-200/70">
            <div>
              <h4 className="text-xs font-serif font-bold text-stone-900">
                Grounded Signal Timeline
              </h4>
              <p className="text-[11px] text-stone-500">
                Changes in personal observations and interpretations over time.
              </p>
            </div>
            <button
              id="analyze-signal-timeline-btn"
              onClick={handleAnalyzeTimeline}
              disabled={loadingTimeline || !isMultiEntryScopeValid}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-xs cursor-pointer shrink-0 ${
                !isMultiEntryScopeValid
                  ? 'bg-stone-100 text-stone-400 border border-stone-200/60 cursor-not-allowed'
                  : 'bg-stone-900 hover:bg-stone-800 text-white active:scale-98'
              }`}
            >
              {loadingTimeline ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>Reasoning Across Timeline...</span>
                </>
              ) : timelineResult ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-300" />
                  <span>Re-Analyze Timeline ({targetEntries.length})</span>
                </>
              ) : (
                <>
                  <Milestone className="w-3.5 h-3.5 text-amber-300" />
                  <span>Analyze Timeline Shifts ({targetEntries.length} {targetEntries.length === 1 ? 'entry' : 'entries'})</span>
                </>
              )}
            </button>
          </div>

          {/* Timeline Error State */}
          {timelineError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start justify-between gap-2">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Timeline Reasoning Error</p>
                  <p className="text-red-600 mt-0.5">{timelineError}</p>
                </div>
              </div>
              <button
                onClick={handleAnalyzeTimeline}
                className="text-red-700 hover:text-red-900 font-medium underline text-xs cursor-pointer shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Timeline Content */}
          {loadingTimeline ? (
            <div className="py-12 text-center space-y-3">
              <Loader2 className="w-7 h-7 animate-spin text-stone-600 mx-auto" />
              <p className="text-xs text-stone-600 font-medium font-serif">
                Tracing perspective and reaction shifts across your dated reflections...
              </p>
              <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
                Validating chronological progression and identifying grounded transitions across your journal entries.
              </p>
            </div>
          ) : timelineResult ? (
            <div className="space-y-4">
              {timelineResult.message && (
                <div className="text-xs text-stone-700 bg-stone-50 p-3 rounded-xl border border-stone-200/70 flex items-start space-x-2">
                  <Info className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{timelineResult.message}</p>
                </div>
              )}

              {!timelineResult.hasSufficientEvidence || timelineResult.shifts.length === 0 ? (
                <div className="text-center py-8 px-4 bg-stone-50/60 rounded-xl border border-stone-200/80 space-y-2">
                  <CheckCircle2 className="w-6 h-6 text-stone-400 mx-auto" />
                  <h4 className="text-xs font-serif font-semibold text-stone-700">
                    No Longitudinal Perspective Shifts Detected
                  </h4>
                  <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                    Across your dated journal reflections, your expressed perspective, tone, and focus remain steady, or additional dated entries are needed before an observable transition over time can be grounded.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-6 before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-stone-200 before:hidden sm:before:block">
                  {timelineResult.shifts.map((shift: SignalTimelineShift, idx: number) => (
                    <div
                      key={idx}
                      id={`timeline-shift-card-${idx}`}
                      className="relative bg-[#FCFCFA] border border-stone-200/90 rounded-2xl p-5 sm:p-6 shadow-2xs space-y-4 hover:border-stone-300 transition-colors"
                    >
                      {/* Node Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="text-[11px] font-semibold text-amber-900 bg-amber-100/80 border border-amber-200/70 px-2 py-0.5 rounded-md">
                              {formatShiftTypeLabel(shift.shiftType)}
                            </span>
                            <span className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-0.5 rounded-md flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-stone-400" />
                              <span>
                                {shift.earlierDate && shift.laterDate
                                  ? `${shift.earlierDate} → ${shift.laterDate}`
                                  : `Across ${shift.evidenceCount} entries`}
                              </span>
                            </span>
                          </div>
                          <h4 className="text-sm sm:text-base font-semibold text-stone-900 pt-1 font-serif">
                            {shift.observation}
                          </h4>
                        </div>
                      </div>

                      {/* Visual Temporal Shift Comparison Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Earlier State */}
                        <div className="bg-stone-50/90 border border-stone-200/80 rounded-xl p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-stone-500 bg-stone-200/70 px-1.5 py-0.5 rounded">
                              Earlier Reflection State
                            </span>
                            {shift.earlierDate && (
                              <span className="text-[10px] text-stone-400 font-mono">
                                {shift.earlierDate}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-800 leading-relaxed font-medium">
                            {shift.earlierState}
                          </p>
                        </div>

                        {/* Later State */}
                        <div className="bg-amber-50/40 border border-amber-200/70 rounded-xl p-3.5 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded flex items-center space-x-1">
                              <TrendingUp className="w-3 h-3 text-amber-700 inline" />
                              <span>Later Reflection State</span>
                            </span>
                            {shift.laterDate && (
                              <span className="text-[10px] text-stone-400 font-mono">
                                {shift.laterDate}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-stone-900 leading-relaxed font-medium">
                            {shift.laterState}
                          </p>
                        </div>
                      </div>

                      {/* Grounded Evidence Explanation */}
                      <div className="bg-white p-3.5 rounded-xl border border-stone-150 text-xs text-stone-700 leading-relaxed">
                        <span className="font-medium text-stone-900 mr-1.5">Grounded Evidence:</span>
                        {shift.explanation}
                      </div>

                      {/* Supporting Journal Entries */}
                      {Array.isArray(shift.supportingEntries) && shift.supportingEntries.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <p className="text-[11px] font-medium text-stone-500 flex items-center space-x-1">
                            <FileText className="w-3 h-3 text-stone-400" />
                            <span>Supporting Timeline Entries:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {shift.supportingEntries.map((se, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleOpenSupportingEntry(se.entryId)}
                                className="inline-flex items-center space-x-1.5 text-xs bg-white hover:bg-stone-100 border border-stone-200 text-stone-800 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer group shadow-2xs"
                                title="Click to view entry details"
                              >
                                <Calendar className="w-3 h-3 text-stone-400 group-hover:text-stone-600" />
                                <span className="font-medium truncate max-w-[150px] sm:max-w-[200px]">
                                  {se.title}
                                </span>
                                {se.date && <span className="text-[10px] text-stone-400">({se.date})</span>}
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
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-stone-50/50 border border-dashed border-stone-200 rounded-xl p-6 text-center space-y-2">
              <Milestone className="w-5 h-5 text-amber-700/70 mx-auto" />
              <h4 className="text-xs font-serif font-semibold text-stone-800">
                Explore Longitudinal Perspective Shifts
              </h4>
              <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
                When you record structured journal entries across time, the timeline engine detects meaningful transitions in your expressed feelings, interpretations, or internal focus.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reflection Wrapped View */}
      {activeTab === 'wrapped' && (
        <ReflectionWrapped
          targetEntries={targetEntries}
          patternsResult={patternsResult}
          timelineResult={timelineResult}
          loadingPatterns={loadingPatterns}
          loadingTimeline={loadingTimeline}
          onAnalyzePatterns={handleAnalyzePatterns}
          onAnalyzeTimeline={handleAnalyzeTimeline}
          onSelectEntry={onSelectEntry}
        />
      )}

      {/* Then vs Now View */}
      {activeTab === 'then_now' && (
        <ThenVsNowComparison
          targetEntries={targetEntries}
          timelineResult={timelineResult}
          loadingTimeline={loadingTimeline}
          onAnalyzeTimeline={handleAnalyzeTimeline}
          onSelectEntry={onSelectEntry}
        />
      )}

      {/* Ask My Journal View */}
      {activeTab === 'ask_journal' && (
        <AskMyJournal
          targetEntries={targetEntries}
          question={askJournalQuestion}
          onQuestionChange={setAskJournalQuestion}
          onAskQuestion={handleAskJournal}
          result={askJournalResult}
          loading={loadingAskJournal}
          error={askJournalError}
          onSelectEntry={onSelectEntry}
        />
      )}
    </div>
  );
};

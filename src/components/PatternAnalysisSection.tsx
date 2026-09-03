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
  PersonalThemesResult,
  ReflectionConnectionsResult,
} from '../types';
import { auth } from '../lib/firebase';
import { ReflectionWrapped } from './ReflectionWrapped';
import { ThenVsNowComparison } from './ThenVsNowComparison';
import { AskMyJournal } from './AskMyJournal';
import { PersonalThemesView } from './PersonalThemesView';
import { ReflectionConnectionsView } from './ReflectionConnectionsView';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import {
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
  ArrowLeft,
  ArrowRight,
  Clock,
  Filter,
  CheckSquare,
  Square,
  X,
  MessageSquareQuote,
  Tag,
  GitCommit,
} from 'lucide-react';

interface PatternAnalysisSectionProps {
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
}

interface ScopeDialogAccessibilityProps {
  onClose: () => void;
  initialFocusRef: React.RefObject<HTMLElement | null>;
  children: (dialogRef: React.RefObject<HTMLDivElement | null>) => React.ReactNode;
}

const ScopeDialogAccessibility: React.FC<ScopeDialogAccessibilityProps> = ({
  onClose,
  initialFocusRef,
  children,
}) => {
  const dialogRef = useDialogAccessibility(onClose, initialFocusRef);

  return <>{children(dialogRef)}</>;
};

type InsightToolId =
  | 'wrapped'
  | 'patterns'
  | 'themes'
  | 'connections'
  | 'timeline'
  | 'then_now'
  | 'contradictions'
  | 'ask_journal';

const INSIGHT_GROUPS: Array<{
  label: string;
  layout: 'wide' | 'grid';
  tools: Array<{
    id: InsightToolId;
    name: string;
    description: string;
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  }>;
}> = [
  {
    label: 'Overview',
    layout: 'wide',
    tools: [
      {
        id: 'wrapped',
        name: 'Reflection Wrapped',
        description: 'A grounded overview of the patterns and shifts across your reflections.',
        icon: Compass,
      },
    ],
  },
  {
    label: 'Recurring Signals',
    layout: 'grid',
    tools: [
      {
        id: 'patterns',
        name: 'Patterns',
        description: 'Notice recurring situations, reactions, and interpretations.',
        icon: Sparkles,
      },
      {
        id: 'themes',
        name: 'Themes',
        description: 'Explore broader themes grounded in what you have recorded.',
        icon: Tag,
      },
      {
        id: 'connections',
        name: 'Connections',
        description: 'See meaningful links between individual reflections.',
        icon: GitCommit,
      },
    ],
  },
  {
    label: 'Change Over Time',
    layout: 'grid',
    tools: [
      {
        id: 'timeline',
        name: 'Timeline',
        description: 'Follow notable shifts across the chronology of your journal.',
        icon: Milestone,
      },
      {
        id: 'then_now',
        name: 'Then vs Now',
        description: 'Compare earlier and later perspectives side by side.',
        icon: Clock,
      },
      {
        id: 'contradictions',
        name: 'Differences',
        description: 'Notice where similar situations were interpreted or felt differently.',
        icon: Split,
      },
    ],
  },
];

// Ask My Journal is promoted to a standalone Hub hero and is intentionally
// not part of INSIGHT_GROUPS; its display name is merged in separately so
// the parent detail heading (INSIGHT_TOOL_NAMES[selectedTool]) still resolves.
const INSIGHT_TOOL_NAMES: Record<InsightToolId, string> = {
  ask_journal: 'Ask My Journal',
  ...Object.fromEntries(
    INSIGHT_GROUPS.flatMap((group) => group.tools.map((tool) => [tool.id, tool.name])),
  ),
} as Record<InsightToolId, string>;

export const PatternAnalysisSection: React.FC<PatternAnalysisSectionProps> = ({
  entries,
  onSelectEntry,
}) => {
  const [selectedTool, setSelectedTool] = useState<InsightToolId | null>(null);
  const detailNavigationRef = useRef<HTMLDivElement>(null);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const hubButtonRefs = useRef<Partial<Record<InsightToolId, HTMLButtonElement | null>>>({});
  const lastOpenedToolRef = useRef<InsightToolId | null>(null);
  const hubScrollPositionRef = useRef<number | null>(null);

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

  // Personal Themes State (v2 Server Semantic Clustering)
  const [themesResult, setThemesResult] = useState<PersonalThemesResult | null>(null);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [themesError, setThemesError] = useState<string | null>(null);
  const themesRequestIdRef = useRef<number>(0);
  const themesAbortControllerRef = useRef<AbortController | null>(null);
  const themesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reflection Connections State (Pairwise Semantic Mapping)
  const [connectionsResult, setConnectionsResult] = useState<ReflectionConnectionsResult | null>(null);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const connectionsRequestIdRef = useRef<number>(0);
  const connectionsAbortControllerRef = useRef<AbortController | null>(null);
  const connectionsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter entries that have a structured summary
  const structuredEntries = entries.filter((e) => Boolean(e.summary));

  // Analysis Scope State (Shared across tabs)
  const [scopeMode, setScopeMode] = useState<'all' | 'selected'>('all');
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [draftSelectedEntryIds, setDraftSelectedEntryIds] = useState<string[]>([]);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const scopeCloseButtonRef = useRef<HTMLButtonElement>(null);

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
      themesRequestIdRef.current += 1;
      connectionsRequestIdRef.current += 1;
      if (themesAbortControllerRef.current) {
        themesAbortControllerRef.current.abort();
        themesAbortControllerRef.current = null;
      }
      if (themesTimeoutRef.current) {
        clearTimeout(themesTimeoutRef.current);
        themesTimeoutRef.current = null;
      }
      if (connectionsAbortControllerRef.current) {
        connectionsAbortControllerRef.current.abort();
        connectionsAbortControllerRef.current = null;
      }
      if (connectionsTimeoutRef.current) {
        clearTimeout(connectionsTimeoutRef.current);
        connectionsTimeoutRef.current = null;
      }
      setPatternsResult(null);
      setContradictionsResult(null);
      setTimelineResult(null);
      setAskJournalResult(null);
      setThemesResult(null);
      setConnectionsResult(null);
      setPatternsError(null);
      setContradictionsError(null);
      setTimelineError(null);
      setAskJournalError(null);
      setThemesError(null);
      setConnectionsError(null);
      setLoadingAskJournal(false);
      setLoadingThemes(false);
      setLoadingConnections(false);
    }
  }, [currentScopeKey]);

  // Clean up timers and controllers on unmount
  useEffect(() => {
    return () => {
      if (themesAbortControllerRef.current) {
        themesAbortControllerRef.current.abort();
        themesAbortControllerRef.current = null;
      }
      if (themesTimeoutRef.current) {
        clearTimeout(themesTimeoutRef.current);
        themesTimeoutRef.current = null;
      }
      if (connectionsAbortControllerRef.current) {
        connectionsAbortControllerRef.current.abort();
        connectionsAbortControllerRef.current = null;
      }
      if (connectionsTimeoutRef.current) {
        clearTimeout(connectionsTimeoutRef.current);
        connectionsTimeoutRef.current = null;
      }
    };
  }, []);

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

  const handleAnalyzeThemes = async () => {
    if (targetEntries.length < 2) return;
    if (loadingThemes) return;

    // Clean up any pending themes timer or in-flight fetch
    if (themesAbortControllerRef.current) {
      themesAbortControllerRef.current.abort();
      themesAbortControllerRef.current = null;
    }
    if (themesTimeoutRef.current) {
      clearTimeout(themesTimeoutRef.current);
      themesTimeoutRef.current = null;
    }

    setLoadingThemes(true);
    setThemesError(null);
    setThemesResult(null);

    const requestScopeKey = currentScopeKey;
    themesRequestIdRef.current += 1;
    const currentRequestId = themesRequestIdRef.current;

    const abortController = new AbortController();
    themesAbortControllerRef.current = abortController;

    // Frontend safety timeout (48 seconds, since backend overall limit is 45s)
    const timeoutId = setTimeout(() => {
      if (themesRequestIdRef.current === currentRequestId && prevScopeKeyRef.current === requestScopeKey) {
        abortController.abort();
        setThemesError('Theme analysis took too long. Please try again.');
        setLoadingThemes(false);
      }
    }, 48000);
    themesTimeoutRef.current = timeoutId;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be signed in to analyze personal themes.');
      }

      const idToken = await currentUser.getIdToken();

      const payloadEntries = targetEntries.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        summary: e.summary,
      }));

      const res = await fetch('/api/themes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          entries: payloadEntries,
        }),
        signal: abortController.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || 'Failed to analyze personal themes.'));
      }

      // Race-protection: only commit result if active scope key has not changed and requestId is latest
      if (prevScopeKeyRef.current === requestScopeKey && themesRequestIdRef.current === currentRequestId) {
        setThemesResult(data.result);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (prevScopeKeyRef.current === requestScopeKey && themesRequestIdRef.current === currentRequestId) {
          setThemesError((prev) => prev || 'Theme analysis took too long. Please try again.');
        }
      } else {
        console.error('Personal Themes analysis error:', err);
        if (prevScopeKeyRef.current === requestScopeKey && themesRequestIdRef.current === currentRequestId) {
          setThemesError(err?.message || 'Unable to discover personal themes across reflections.');
        }
      }
    } finally {
      if (themesTimeoutRef.current === timeoutId) {
        clearTimeout(themesTimeoutRef.current);
        themesTimeoutRef.current = null;
      }
      if (themesAbortControllerRef.current === abortController) {
        themesAbortControllerRef.current = null;
      }
      if (prevScopeKeyRef.current === requestScopeKey && themesRequestIdRef.current === currentRequestId) {
        setLoadingThemes(false);
      }
    }
  };

  const handleAnalyzeConnections = async () => {
    if (targetEntries.length < 2) return;
    if (loadingConnections) return;

    // Clean up any pending connections timer or in-flight fetch
    if (connectionsAbortControllerRef.current) {
      connectionsAbortControllerRef.current.abort();
      connectionsAbortControllerRef.current = null;
    }
    if (connectionsTimeoutRef.current) {
      clearTimeout(connectionsTimeoutRef.current);
      connectionsTimeoutRef.current = null;
    }

    setLoadingConnections(true);
    setConnectionsError(null);
    setConnectionsResult(null);

    const requestScopeKey = currentScopeKey;
    connectionsRequestIdRef.current += 1;
    const currentRequestId = connectionsRequestIdRef.current;

    const abortController = new AbortController();
    connectionsAbortControllerRef.current = abortController;

    // Frontend safety timeout (48 seconds, matching backend overall limit of 45s)
    const timeoutId = setTimeout(() => {
      if (connectionsRequestIdRef.current === currentRequestId && prevScopeKeyRef.current === requestScopeKey) {
        abortController.abort();
        setConnectionsError('Connection analysis took too long. Please try again.');
        setLoadingConnections(false);
      }
    }, 48000);
    connectionsTimeoutRef.current = timeoutId;

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be signed in to analyze reflection connections.');
      }

      const idToken = await currentUser.getIdToken();

      const payloadEntries = targetEntries.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        summary: e.summary,
      }));

      const res = await fetch('/api/connections', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          entries: payloadEntries,
        }),
        signal: abortController.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.details ? `${data.error || 'Error'}: ${data.details}` : (data.error || 'Failed to analyze reflection connections.'));
      }

      // Race-protection: only commit result if active scope key has not changed and requestId is latest
      if (prevScopeKeyRef.current === requestScopeKey && connectionsRequestIdRef.current === currentRequestId) {
        setConnectionsResult(data.result);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (prevScopeKeyRef.current === requestScopeKey && connectionsRequestIdRef.current === currentRequestId) {
          setConnectionsError((prev) => prev || 'Connection analysis took too long. Please try again.');
        }
      } else {
        console.error('Reflection Connections analysis error:', err);
        if (prevScopeKeyRef.current === requestScopeKey && connectionsRequestIdRef.current === currentRequestId) {
          setConnectionsError(err?.message || 'Unable to discover reflection connections across reflections.');
        }
      }
    } finally {
      if (connectionsTimeoutRef.current === timeoutId) {
        clearTimeout(connectionsTimeoutRef.current);
        connectionsTimeoutRef.current = null;
      }
      if (connectionsAbortControllerRef.current === abortController) {
        connectionsAbortControllerRef.current = null;
      }
      if (prevScopeKeyRef.current === requestScopeKey && connectionsRequestIdRef.current === currentRequestId) {
        setLoadingConnections(false);
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
        return 'Change in perspective';
      case 'emotional_reaction':
        return 'Change in emotional reaction';
      case 'interpretation':
        return 'Change in interpretation';
      case 'focus':
        return 'Change in focus';
      default:
        return 'Recorded change';
    }
  };

  const formatTimelineRole = (role: string | undefined) => {
    switch (role) {
      case 'earlier_state':
        return 'Earlier';
      case 'later_state':
        return 'Later';
      case 'context':
        return 'Context';
      default:
        return role
          ? role.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase())
          : 'Supporting';
    }
  };

  const presentationTimelineShifts = (timelineResult?.shifts ?? [])
    .map((shift, originalIndex) => ({ shift, originalIndex }))
    .sort((a, b) => {
      const earlierA = a.shift.earlierDate ? Date.parse(a.shift.earlierDate) : Number.NaN;
      const earlierB = b.shift.earlierDate ? Date.parse(b.shift.earlierDate) : Number.NaN;
      const laterA = a.shift.laterDate ? Date.parse(a.shift.laterDate) : Number.NaN;
      const laterB = b.shift.laterDate ? Date.parse(b.shift.laterDate) : Number.NaN;
      const safeEarlierA = Number.isNaN(earlierA) ? Number.POSITIVE_INFINITY : earlierA;
      const safeEarlierB = Number.isNaN(earlierB) ? Number.POSITIVE_INFINITY : earlierB;

      if (safeEarlierA !== safeEarlierB) return safeEarlierA - safeEarlierB;

      const safeLaterA = Number.isNaN(laterA) ? Number.POSITIVE_INFINITY : laterA;
      const safeLaterB = Number.isNaN(laterB) ? Number.POSITIVE_INFINITY : laterB;

      if (safeLaterA !== safeLaterB) return safeLaterA - safeLaterB;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ shift }) => shift);

  useEffect(() => {
    const focusFrame = window.requestAnimationFrame(() => {
      const scrollOwner = document.scrollingElement;

      if (selectedTool) {
        const detailNavigation = detailNavigationRef.current;
        if (scrollOwner && detailNavigation) {
          const stickyHeaderHeight = document.querySelector<HTMLElement>('header')?.getBoundingClientRect().height ?? 0;
          const detailTop = detailNavigation.getBoundingClientRect().top + scrollOwner.scrollTop;
          scrollOwner.scrollTo({
            top: Math.max(0, detailTop - stickyHeaderHeight - 12),
            behavior: 'auto',
          });
        }
        detailHeadingRef.current?.focus({ preventScroll: true });
        return;
      }

      const previousTool = lastOpenedToolRef.current;
      if (previousTool) {
        hubButtonRefs.current[previousTool]?.focus({ preventScroll: true });
      }

      if (scrollOwner && hubScrollPositionRef.current !== null) {
        scrollOwner.scrollTo({ top: hubScrollPositionRef.current, behavior: 'auto' });
      }
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [selectedTool]);

  const handleOpenTool = (toolId: InsightToolId) => {
    hubScrollPositionRef.current = document.scrollingElement?.scrollTop ?? 0;
    lastOpenedToolRef.current = toolId;
    setSelectedTool(toolId);
  };

  const handleBackToInsights = () => {
    setSelectedTool(null);
  };

  return (
    <div id="cross-entry-analysis-section" className="min-w-0 space-y-8">
      {selectedTool === null ? (
        <div className="min-w-0 space-y-10">
          <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
            AI observations are grounded in your recorded reflections.
          </p>

          {/* Ask My Journal: primary Hub hero. Single native button reusing the
              existing handleOpenTool navigation — no request logic here. */}
          <button
            ref={(element) => {
              hubButtonRefs.current.ask_journal = element;
            }}
            type="button"
            onClick={() => handleOpenTool('ask_journal')}
            className="group flex min-h-11 w-full min-w-0 flex-col items-start gap-3 rounded-card border border-border-ai bg-surface-ai px-5 py-6 text-left transition-colors hover:border-accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 sm:px-7 sm:py-7"
          >
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface text-accent-primary">
              <MessageSquareQuote className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 space-y-2">
              <span className="block font-serif text-xl font-semibold leading-tight text-text-primary sm:text-2xl">
                Ask My Journal
              </span>
              <span className="block max-w-reading [overflow-wrap:anywhere] text-sm leading-relaxed text-text-secondary">
                Ask a question about your reflections. Explore something you&rsquo;ve been writing about &mdash; recurring situations, reactions, changes, or something specific you want to understand.
              </span>
              <span className="block max-w-reading [overflow-wrap:anywhere] text-xs leading-relaxed text-text-muted">
                For example: &ldquo;What patterns keep appearing?&rdquo; or &ldquo;How has my perspective changed?&rdquo;
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-primary">
              <span>Ask my journal</span>
              <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </button>

          {INSIGHT_GROUPS.map((group) => (
            <React.Fragment key={group.label}>
              {group.label === 'Recurring Signals' && (
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
                  Explore further
                </h3>
              )}
              <section aria-labelledby={`insight-group-${group.label.toLowerCase().replaceAll(' ', '-')}`} className="min-w-0 space-y-3">
                <h3
                  id={`insight-group-${group.label.toLowerCase().replaceAll(' ', '-')}`}
                  className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted"
                >
                  {group.label}
                </h3>
                <div className={group.layout === 'grid' ? 'grid min-w-0 grid-cols-1 gap-3 md:grid-cols-3' : 'grid min-w-0 grid-cols-1 gap-3'}>
                  {group.tools.map((tool) => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.id}
                        ref={(element) => {
                          hubButtonRefs.current[tool.id] = element;
                        }}
                        type="button"
                        onClick={() => handleOpenTool(tool.id)}
                        className="group flex min-h-11 min-w-0 w-full items-start gap-4 rounded-card border border-border bg-surface px-4 py-4 text-left shadow-low transition-colors hover:border-border-strong hover:bg-surface-subtle sm:px-5 sm:py-5"
                      >
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-surface-ai text-accent-primary">
                          <Icon className="h-5 w-5" aria-hidden={true} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-serif text-lg font-semibold leading-tight text-text-primary">
                            {tool.name}
                          </span>
                          <span className="mt-1 block [overflow-wrap:anywhere] text-sm leading-relaxed text-text-secondary">
                            {tool.description}
                          </span>
                        </span>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-text-muted transition-colors group-hover:text-accent-primary" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              </section>
            </React.Fragment>
          ))}
        </div>
      ) : (
        <>
          <div ref={detailNavigationRef} className="flex min-w-0 flex-col items-start gap-2 border-b border-border pb-4 sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={handleBackToInsights}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-2 text-sm font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Insights
            </button>
            <h3 ref={detailHeadingRef} tabIndex={-1} className="min-w-0 [overflow-wrap:anywhere] font-serif text-lg font-semibold text-text-primary">
              {INSIGHT_TOOL_NAMES[selectedTool]}
            </h3>
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
              type="button"
              aria-pressed={scopeMode === 'all'}
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
              type="button"
              aria-pressed={scopeMode === 'selected'}
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
              type="button"
              onClick={handleOpenScopeModal}
              className="text-[11px] text-amber-800 hover:text-amber-950 font-medium underline underline-offset-2 cursor-pointer"
            >
              Edit scope
            </button>
          )}
        </div>
      </div>

      {targetEntries.length < 2 && selectedTool !== 'ask_journal' && (
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
              type="button"
              onClick={handleOpenScopeModal}
              className="text-amber-900 font-semibold underline text-xs cursor-pointer shrink-0"
            >
              Select Reflections
            </button>
          )}
        </div>
      )}

      {targetEntries.length === 0 && selectedTool === 'ask_journal' && (
        <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              Select at least 1 reflection to ask questions about your journal.
            </span>
          </div>
          {scopeMode === 'selected' && (
            <button
              type="button"
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
        <ScopeDialogAccessibility onClose={handleCloseScopeModal} initialFocusRef={scopeCloseButtonRef}>
          {(scopeDialogRef) => (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
              <div
                ref={scopeDialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="scope-dialog-title"
                aria-describedby="scope-dialog-description"
                tabIndex={-1}
                className="bg-white w-full max-w-lg rounded-2xl border border-stone-200 shadow-xl overflow-hidden flex flex-col max-h-[85vh]"
              >
            <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-amber-700" />
                <h3 id="scope-dialog-title" className="font-serif font-bold text-stone-900 text-sm">
                  Select Reflections for Cross-Entry Analysis
                </h3>
              </div>
              <button
                ref={scopeCloseButtonRef}
                type="button"
                onClick={handleCloseScopeModal}
                aria-label="Close reflection scope selector"
                className="min-h-11 min-w-11 inline-flex items-center justify-center p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-stone-50 border-b border-stone-100 flex items-center justify-between text-xs text-stone-600">
              <span id="scope-dialog-description">
                Selected: <strong className="text-stone-900">{draftSelectedEntryIds.length}</strong> of {structuredEntries.length} reflections
              </span>
              <div className="space-x-2">
                <button
                  type="button"
                  onClick={handleSelectAllDraftScope}
                  className="text-amber-800 hover:text-amber-950 font-medium underline text-[11px] cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-stone-300">|</span>
                <button
                  type="button"
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
                  type="button"
                  onClick={handleResetToAll}
                  className="px-3 py-1.5 rounded-lg text-xs text-stone-600 hover:text-stone-800 bg-white border border-stone-200 cursor-pointer"
                >
                  Reset to All
                </button>
                <button
                  id="apply-scope-modal-btn"
                  type="button"
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
        </ScopeDialogAccessibility>
      )}

      {/* TAB 1: RECURRING PATTERNS (DAY 5) */}
      {selectedTool === 'patterns' && (
        <div id="recurring-patterns-tab-content" className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
              Notice recurring reactions, interpretations, and signals across your reflections.
            </p>
            <button
              id="analyze-cross-entry-patterns-btn"
              type="button"
              onClick={handleAnalyzePatterns}
              disabled={loadingPatterns || !isMultiEntryScopeValid}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-semibold shadow-xs transition-colors sm:w-auto ${
                !isMultiEntryScopeValid
                  ? 'cursor-not-allowed border border-border bg-surface-subtle text-text-muted opacity-70'
                  : 'cursor-pointer bg-accent-primary text-white hover:bg-accent-primary-hover'
              }`}
            >
              {loadingPatterns ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Reviewing reflections…</span>
                </>
              ) : patternsResult ? (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Refresh observations</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Surface Patterns</span>
                </>
              )}
            </button>
          </div>

          {/* Patterns Error State */}
          {patternsError && (
            <div role="alert" className="flex flex-col items-start justify-between gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold">AI observations could not be generated</p>
                  <p className="mt-1 leading-relaxed text-red-700">{patternsError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAnalyzePatterns}
                className="inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-red-700 underline underline-offset-2 hover:bg-red-100 hover:text-red-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Patterns Content */}
          {loadingPatterns ? (
            <div role="status" aria-live="polite" className="space-y-3 py-12 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent-primary" aria-hidden="true" />
              <p className="font-serif text-base font-semibold text-text-primary">
                Looking across the reflections in this scope…
              </p>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                AI is looking for recurring signals supported by more than one of your recorded reflections.
              </p>
            </div>
          ) : patternsResult ? (
            <section aria-labelledby="patterns-ai-observations-title" className="space-y-5 border-t border-border pt-5">
              <div className="space-y-1">
                <h4 id="patterns-ai-observations-title" className="font-serif text-lg font-semibold text-text-primary">
                  AI observations
                </h4>
                <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
                  Generated only from the reflections included in the current scope. Treat these as prompts for reflection, not facts or diagnoses.
                </p>
              </div>

              {patternsResult.message && (
                <div className="flex items-start gap-3 rounded-card bg-surface-ai px-4 py-3 text-sm text-text-secondary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                  <p className="leading-relaxed">{patternsResult.message}</p>
                </div>
              )}

              {!patternsResult.hasSufficientEvidence || patternsResult.patterns.length === 0 ? (
                <div className="space-y-2 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
                  <h5 className="font-serif text-base font-semibold text-text-primary">
                    No recurring signals yet
                  </h5>
                  <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                    The reflections in this scope do not yet offer enough consistent support for a recurring observation. More writing over time may make meaningful connections easier to notice.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {patternsResult.patterns.map((pat: CrossEntryPattern, idx: number) => (
                    <article
                      key={idx}
                      id={`pattern-card-${idx}`}
                      className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-low sm:p-6"
                    >
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent-primary">
                          Observation {idx + 1}
                        </p>
                        <h5 className="font-serif text-lg font-semibold leading-snug text-text-primary">
                          {pat.observation}
                        </h5>
                        <p className="text-sm leading-relaxed text-text-secondary">
                          {pat.explanation}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs text-text-muted">
                        <span>
                          {pat.evidenceCount} supporting {pat.evidenceCount === 1 ? 'reflection' : 'reflections'}
                        </span>
                        {(pat.evidenceStrength === 'thin' || pat.evidenceCount === 2) && <span>Early journal support</span>}
                        {(pat.evidenceStrength === 'emerging' || pat.evidenceCount === 3) && <span>Emerging journal support</span>}
                        {(pat.evidenceStrength === 'strong' || pat.evidenceCount >= 4) && <span>Consistent journal support</span>}
                      </div>

                      {Array.isArray(pat.supportingEntries) && pat.supportingEntries.length > 0 && (
                        <div className="space-y-2">
                          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <FileText className="h-4 w-4 text-user-accent" aria-hidden="true" />
                            <span>Supporting reflections</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {pat.supportingEntries.map((se, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleOpenSupportingEntry(se.entryId)}
                                className="group inline-flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-control border border-border bg-surface-user px-3 py-2 text-left text-sm text-text-primary transition-colors hover:border-border-strong hover:bg-surface-subtle sm:w-auto"
                                title={`Open reflection: ${se.title}`}
                              >
                                <Calendar className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate font-medium sm:max-w-[220px]">
                                  {se.title}
                                </span>
                                {se.date && <span className="shrink-0 text-xs text-text-muted">{se.date}</span>}
                                <ChevronRight className="h-4 w-4 shrink-0 text-text-muted group-hover:text-text-primary" aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <div className="space-y-2 border-t border-border py-8 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-accent-primary" aria-hidden="true" />
              <h4 className="font-serif text-base font-semibold text-text-primary">
                No AI observations yet
              </h4>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                Surface Patterns to look for recurring signals supported by the reflections in your current scope.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Differences: calm interpretation-difference view */}
      {selectedTool === 'contradictions' && (
        <div id="perspective-differences-tab-content" className="space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
              Notice where similar situations in your reflections were interpreted or felt differently.
            </p>
            <button
              id="analyze-cross-entry-contradictions-btn"
              type="button"
              onClick={handleAnalyzeContradictions}
              disabled={loadingContradictions || !isMultiEntryScopeValid}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-semibold shadow-xs transition-colors sm:w-auto ${
                !isMultiEntryScopeValid
                  ? 'cursor-not-allowed border border-border bg-surface-subtle text-text-muted opacity-70'
                  : 'cursor-pointer bg-accent-primary text-white hover:bg-accent-primary-hover'
              }`}
            >
              {loadingContradictions ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Finding differences…</span>
                </>
              ) : contradictionsResult ? (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Refresh differences</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  <span>Find differences</span>
                </>
              )}
            </button>
          </div>

          {/* AI provenance */}
          <div className="flex items-start gap-3 rounded-card bg-surface-ai px-4 py-3 text-sm text-text-secondary">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
            <p className="leading-relaxed">
              Based only on reflections in the current scope. AI is identifying places where similar situations were interpreted or felt differently — a difference does not mean a contradiction, and neither interpretation is necessarily more correct. This is not a diagnosis, not a claim about hidden motives or fixed identity, and similarity or chronology does not prove causation.
            </p>
          </div>

          {/* Differences Error State */}
          {contradictionsError && (
            <div role="alert" className="flex flex-col items-start justify-between gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold">AI observations could not be generated</p>
                  <p className="mt-1 leading-relaxed text-red-700">{contradictionsError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeContradictions}
                className="inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-sm font-semibold text-red-700 underline underline-offset-2 hover:bg-red-100 hover:text-red-900"
              >
                Retry
              </button>
            </div>
          )}

          {/* Differences Content */}
          {loadingContradictions ? (
            <div role="status" aria-live="polite" className="space-y-3 py-12 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent-primary" aria-hidden="true" />
              <p className="font-serif text-base font-semibold text-text-primary">Finding differences…</p>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                AI is looking for similar situations in this scope that were interpreted or felt differently.
              </p>
            </div>
          ) : contradictionsResult ? (
            <section aria-label="Differences results" className="space-y-5 border-t border-border pt-5">
              {contradictionsResult.message && (
                <div className="flex items-start gap-3 rounded-card bg-surface-ai px-4 py-3 text-sm text-text-secondary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                  <p className="leading-relaxed">{contradictionsResult.message}</p>
                </div>
              )}

              {!contradictionsResult.hasSufficientEvidence || contradictionsResult.contradictions.length === 0 ? (
                <div className="space-y-2 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
                  <h5 className="font-serif text-base font-semibold text-text-primary">No clear differences surfaced</h5>
                  <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                    The reflections in this scope may not contain enough grounded contrast for a useful comparison, or more reflections may be needed before a difference can be observed.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {contradictionsResult.contradictions.map((contra: CrossEntryContradiction, idx: number) => (
                    <article
                      key={idx}
                      id={`contradiction-card-${idx}`}
                      className="space-y-4 rounded-card border border-border bg-surface p-5 shadow-low sm:p-6"
                    >
                      <div className="space-y-2">
                        <h4 className="font-serif text-lg font-semibold leading-snug text-text-primary">
                          {contra.observation}
                        </h4>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">What may differ</p>
                          <p className="text-sm leading-relaxed text-text-secondary">{contra.explanation}</p>
                        </div>
                      </div>

                      {Array.isArray(contra.supportingEntries) && contra.supportingEntries.length > 0 && (
                        <div className="space-y-2 border-t border-border pt-4">
                          <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                            <FileText className="h-4 w-4 text-user-accent" aria-hidden="true" />
                            <span>Supporting reflections</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {contra.supportingEntries.map((se, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleOpenSupportingEntry(se.entryId)}
                                className="flex min-h-11 min-w-0 max-w-full items-center gap-2 rounded-control border border-border bg-surface-user px-3 py-2 text-left text-sm text-text-primary transition-colors hover:border-border-strong hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
                                title={`Open reflection: ${se.title}`}
                              >
                                <Calendar className="h-4 w-4 shrink-0 text-user-accent" aria-hidden="true" />
                                <span className="min-w-0 flex-1 [overflow-wrap:anywhere] font-medium">
                                  {se.title}
                                </span>
                                {se.date && <span className="shrink-0 text-xs text-text-muted">{se.date}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {contra.clarifyingQuestion && (
                        <div className="space-y-1 border-t border-border pt-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                            <Compass className="h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                            <span>Question to sit with</span>
                          </div>
                          <p className="font-serif text-base italic leading-relaxed text-text-primary">
                            {contra.clarifyingQuestion}
                          </p>
                        </div>
                      )}

                      <p className="border-t border-border pt-3 text-xs text-text-muted">
                        {contra.evidenceCount} supporting {contra.evidenceCount === 1 ? 'reflection' : 'reflections'}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <div className="space-y-2 border-t border-border py-8 text-center">
              <Split className="mx-auto h-5 w-5 text-accent-primary" aria-hidden="true" />
              <h4 className="font-serif text-base font-semibold text-text-primary">No differences yet</h4>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                Find differences when you are ready to notice where similar situations in this scope were interpreted or felt differently.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SIGNAL TIMELINE (PERSPECTIVE CHANGE OVER TIME) */}
      {selectedTool === 'timeline' && (
        <div id="signal-timeline-tab-content" className="min-w-0 space-y-6">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
              Notice how recorded reactions, interpretations, or focus may differ across reflections over time.
            </p>
            <button
              id="analyze-signal-timeline-btn"
              type="button"
              onClick={handleAnalyzeTimeline}
              disabled={loadingTimeline || !isMultiEntryScopeValid}
              className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm font-semibold shadow-xs transition-colors sm:w-auto ${
                !isMultiEntryScopeValid
                  ? 'cursor-not-allowed border border-border bg-surface-subtle text-text-muted opacity-70'
                  : 'cursor-pointer bg-accent-primary text-white hover:bg-accent-primary-hover'
              }`}
            >
              {loadingTimeline ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Looking across reflections…</span>
                </>
              ) : timelineResult ? (
                <>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  <span>Refresh timeline</span>
                </>
              ) : (
                <>
                  <Milestone className="h-4 w-4" aria-hidden="true" />
                  <span>Find changes over time</span>
                </>
              )}
            </button>
          </div>

          {timelineError && (
            <div role="alert" className="flex flex-col items-start justify-between gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-start gap-3">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <p className="font-semibold">AI observations could not be generated</p>
                  <p className="mt-1 leading-relaxed">{timelineError}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeTimeline}
                className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-semibold text-red-700 underline underline-offset-2 hover:bg-red-100 hover:text-red-900"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loadingTimeline ? (
            <div role="status" aria-live="polite" className="space-y-3 py-12 text-center">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-accent-primary" aria-hidden="true" />
              <p className="font-serif text-base font-semibold text-text-primary">Looking across these reflections…</p>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                AI is considering where recorded reactions, interpretations, or focus may differ over time.
              </p>
            </div>
          ) : timelineResult ? (
            <section aria-labelledby="timeline-ai-observations-title" className="space-y-6 border-t border-border pt-5">
              <div className="space-y-1">
                <h4 id="timeline-ai-observations-title" className="font-serif text-lg font-semibold text-text-primary">AI observations</h4>
                <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
                  Generated only from reflections in the current scope. These are interpretive observations: chronology does not prove causation, later does not mean better or worse, and the results are not diagnoses, fixed identity claims, or explanations of hidden motives.
                </p>
              </div>

              {timelineResult.message && (
                <div className="flex items-start gap-3 border-l-2 border-border pl-4 text-sm text-text-secondary">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p className="leading-relaxed">{timelineResult.message}</p>
                </div>
              )}

              {!timelineResult.hasSufficientEvidence || timelineResult.shifts.length === 0 ? (
                <div className="space-y-2 py-8 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
                  <h5 className="font-serif text-base font-semibold text-text-primary">No clear changes surfaced</h5>
                  <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                    The selected reflections did not provide enough contrast for a useful observation. This does not imply that nothing changed outside what was recorded.
                  </p>
                </div>
              ) : (
                <ul className="relative min-w-0 space-y-8 pl-7 before:absolute before:bottom-4 before:left-[7px] before:top-4 before:w-px before:bg-border sm:pl-9">
                  {presentationTimelineShifts.map((shift: SignalTimelineShift, idx: number) => (
                    <li
                      key={`${shift.earlierDate ?? 'undated'}-${shift.laterDate ?? 'undated'}-${idx}`}
                      id={`timeline-shift-card-${idx}`}
                      className="relative min-w-0 space-y-6 border-b border-border pb-8 last:border-b-0 last:pb-0"
                    >
                      <span className="absolute -left-7 top-1 h-4 w-4 rounded-full border-4 border-background bg-accent-primary sm:-left-9" aria-hidden="true" />

                      <header className="min-w-0 space-y-2">
                        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-text-secondary">
                          <Calendar className="h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                          <span className="[overflow-wrap:anywhere]">
                            {shift.earlierDate && shift.laterDate
                              ? `${shift.earlierDate} – ${shift.laterDate}`
                              : shift.earlierDate || shift.laterDate || 'Date context unavailable'}
                          </span>
                        </p>
                        <h5 className="max-w-reading font-serif text-lg font-semibold leading-relaxed text-text-primary">
                          {shift.observation}
                        </h5>
                      </header>

                      <div className="grid min-w-0 grid-cols-1 gap-5 border-y border-border py-5 md:grid-cols-2">
                        <section className="min-w-0 space-y-2">
                          <h6 className="text-sm font-semibold text-text-secondary">Earlier reflection</h6>
                          {shift.earlierDate && <p className="text-[13px] text-text-muted">{shift.earlierDate}</p>}
                          <p className="font-serif text-base leading-relaxed text-text-primary">{shift.earlierState}</p>
                        </section>
                        <section className="min-w-0 space-y-2 md:border-l md:border-border md:pl-5">
                          <h6 className="text-sm font-semibold text-text-secondary">Later reflection</h6>
                          {shift.laterDate && <p className="text-[13px] text-text-muted">{shift.laterDate}</p>}
                          <p className="font-serif text-base leading-relaxed text-text-primary">{shift.laterState}</p>
                        </section>
                      </div>

                      <div className="space-y-2">
                        <h6 className="text-sm font-semibold text-text-secondary">From the recorded reflections</h6>
                        <p className="max-w-reading text-sm leading-relaxed text-text-secondary">{shift.explanation}</p>
                      </div>

                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-text-muted">
                        <p><span className="font-semibold text-text-secondary">Type:</span> {formatShiftTypeLabel(shift.shiftType)}</p>
                        <p><span className="font-semibold text-text-secondary">Journal support:</span> {shift.evidenceCount} {shift.evidenceCount === 1 ? 'reflection' : 'reflections'}</p>
                      </div>

                      {Array.isArray(shift.supportingEntries) && shift.supportingEntries.length > 0 && (
                        <section className="min-w-0 space-y-2" aria-label="Supporting reflections">
                          <h6 className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                            <FileText className="h-4 w-4 text-text-muted" aria-hidden="true" />
                            Supporting reflections
                          </h6>
                          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                            {shift.supportingEntries.map((se, sIdx) => (
                              <button
                                key={sIdx}
                                type="button"
                                onClick={() => handleOpenSupportingEntry(se.entryId)}
                                className="flex min-h-11 min-w-0 max-w-full items-start gap-3 rounded-control border border-border bg-surface px-3 py-2.5 text-left text-sm text-text-primary transition-colors hover:bg-surface-subtle"
                                title="Click to view entry details"
                              >
                                <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                                <span className="min-w-0 flex-1">
                                  <span className="block [overflow-wrap:anywhere] font-semibold">{se.title}</span>
                                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-text-muted">
                                    {se.date && <span>{se.date}</span>}
                                    <span>{formatTimelineRole(se.roleInShift)}</span>
                                  </span>
                                </span>
                                <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </section>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : (
            <div className="space-y-2 border-t border-border py-8 text-center">
              <Milestone className="mx-auto h-6 w-6 text-text-muted" aria-hidden="true" />
              <h4 className="font-serif text-base font-semibold text-text-primary">No AI observations yet</h4>
              <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
                Find changes over time when you are ready to compare what you recorded across this scope.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reflection Wrapped View */}
      {selectedTool === 'wrapped' && (
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
      {selectedTool === 'then_now' && (
        <ThenVsNowComparison
          targetEntries={targetEntries}
          timelineResult={timelineResult}
          loadingTimeline={loadingTimeline}
          onAnalyzeTimeline={handleAnalyzeTimeline}
          onSelectEntry={onSelectEntry}
        />
      )}

      {/* Ask My Journal View */}
      {selectedTool === 'ask_journal' && (
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

      {/* Personal Themes View */}
      {selectedTool === 'themes' && (
        <PersonalThemesView
          targetEntries={targetEntries}
          allEntries={entries}
          result={themesResult}
          loading={loadingThemes}
          error={themesError}
          onAnalyzeThemes={handleAnalyzeThemes}
          onSelectEntry={onSelectEntry}
        />
      )}

      {/* Reflection Connections View */}
      {selectedTool === 'connections' && (
        <ReflectionConnectionsView
          targetEntries={targetEntries}
          allEntries={entries}
          result={connectionsResult}
          loading={loadingConnections}
          error={connectionsError}
          onAnalyzeConnections={handleAnalyzeConnections}
          onSelectEntry={onSelectEntry}
        />
      )}
        </>
      )}
    </div>
  );
};

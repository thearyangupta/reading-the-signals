import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useBlocker } from 'react-router-dom';
import { Loader2, PenLine, Save, Sparkles, X } from 'lucide-react';
import { auth, createJournalEntry, updateJournalEntry } from '../lib/firebase';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { JournalEntry, StructuredSummary } from '../types';

interface JournalEditorProps {
  userId: string;
  initialEntry?: JournalEntry | null;
  onClose: () => void;
  onSaveSuccess: (entry: Partial<JournalEntry>) => void;
  presentation?: 'modal' | 'page';
}

type EditorMode = 'freeform' | 'guided';
type DiscardIntent = 'close' | 'navigation';

export const JournalEditor: React.FC<JournalEditorProps> = ({
  userId,
  initialEntry,
  onClose,
  onSaveSuccess,
  presentation = 'modal',
}) => {
  const initialValues = useRef({
    title: initialEntry?.title || '',
    date: initialEntry?.date || new Date().toISOString().split('T')[0],
    content: initialEntry?.content || '',
    situation: initialEntry?.situation || '',
    behaviorOrEvent: initialEntry?.behaviorOrEvent || '',
    feelingOrReaction: initialEntry?.feelingOrReaction || '',
    importantContext: initialEntry?.importantContext || '',
  });

  const [mode, setMode] = useState<EditorMode>('freeform');
  const [title, setTitle] = useState(initialValues.current.title);
  const [date, setDate] = useState(initialValues.current.date);
  const [content, setContent] = useState(initialValues.current.content);
  const [situation, setSituation] = useState(initialValues.current.situation);
  const [behaviorOrEvent, setBehaviorOrEvent] = useState(initialValues.current.behaviorOrEvent);
  const [feelingOrReaction, setFeelingOrReaction] = useState(initialValues.current.feelingOrReaction);
  const [importantContext, setImportantContext] = useState(initialValues.current.importantContext);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveIntent, setSaveIntent] = useState<'save' | 'analyze' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [discardIntent, setDiscardIntent] = useState<DiscardIntent | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const continueWritingRef = useRef<HTMLButtonElement>(null);
  const discardReturnFocusRef = useRef<HTMLElement | null>(null);
  const aiRequestIdRef = useRef(0);
  const aiAbortControllerRef = useRef<AbortController | null>(null);
  const aiTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(false);

  const isDirty =
    title !== initialValues.current.title ||
    date !== initialValues.current.date ||
    content !== initialValues.current.content ||
    situation !== initialValues.current.situation ||
    behaviorOrEvent !== initialValues.current.behaviorOrEvent ||
    feelingOrReaction !== initialValues.current.feelingOrReaction ||
    importantContext !== initialValues.current.importantContext;

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  }, [isDirty]);

  useBeforeUnload(handleBeforeUnload);

  const blocker = useBlocker(isDirty && !saving);
  const discardOpen = discardIntent !== null;

  useEffect(() => {
    if (blocker.state !== 'blocked') return;

    discardReturnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setDiscardIntent('navigation');
  }, [blocker.state]);

  const requestClose = () => {
    if (saving) return;
    if (presentation === 'page') {
      onClose();
      return;
    }
    if (isDirty) {
      discardReturnFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      setDiscardIntent('close');
      return;
    }
    onClose();
  };

  const continueWriting = () => {
    if (discardIntent === 'navigation' && blocker.state === 'blocked') {
      blocker.reset();
    }
    setDiscardIntent(null);
    window.requestAnimationFrame(() => discardReturnFocusRef.current?.focus());
  };

  const discardChanges = () => {
    if (discardIntent === 'navigation' && blocker.state === 'blocked') {
      blocker.proceed();
      if (presentation === 'page') return;
    }
    onClose();
  };

  const handleDialogClose = () => {
    if (discardOpen) {
      continueWriting();
      return;
    }
    requestClose();
  };

  const dialogRef = useDialogAccessibility(handleDialogClose, titleInputRef, presentation === 'modal');
  const isContentValidationError = Boolean(error && !title.trim() && !content.trim());

  useEffect(() => {
    if (discardOpen) continueWritingRef.current?.focus();
  }, [discardOpen]);

  useEffect(() => {
    if (presentation !== 'page') return;
    const focusFrame = window.requestAnimationFrame(() => titleInputRef.current?.focus());
    return () => window.cancelAnimationFrame(focusFrame);
  }, [presentation]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      aiRequestIdRef.current += 1;
      aiAbortControllerRef.current?.abort();
      if (aiTimeoutRef.current) clearTimeout(aiTimeoutRef.current);
    };
  }, []);

  const handleSubmit = async (generateSummary: boolean) => {
    if (!title.trim() && !content.trim()) {
      setError('Please provide at least a title or some reflection content.');
      return;
    }

    try {
      setSaveIntent(generateSummary ? 'analyze' : 'save');
      setSaving(true);
      setError(null);

      let summary: StructuredSummary | null = initialEntry?.summary || null;

      if (generateSummary) {
        setAnalyzing(true);
        const currentAiRequestId = ++aiRequestIdRef.current;
        const abortController = new AbortController();
        aiAbortControllerRef.current = abortController;
        let resolveDeadline!: () => void;
        const deadline = new Promise<void>((resolve) => {
          resolveDeadline = resolve;
        });
        const timeoutId = setTimeout(() => {
          if (aiRequestIdRef.current === currentAiRequestId) {
            aiRequestIdRef.current += 1;
            abortController.abort();
            aiAbortControllerRef.current = null;
            aiTimeoutRef.current = null;
            setError('This took too long. Please try again.');
            setAnalyzing(false);
          }
          resolveDeadline();
        }, 32000);
        aiTimeoutRef.current = timeoutId;

        const generateSummaryWork = async () => {
          try {
            const currentUser = auth.currentUser;
            if (!currentUser) {
              throw new Error('Please sign in to add AI observations.');
            }
            const idToken = await currentUser.getIdToken();
            if (aiRequestIdRef.current !== currentAiRequestId) return;

            const res = await fetch('/api/summarize', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${idToken}`,
              },
              body: JSON.stringify({
                title,
                content,
                situation,
                behaviorOrEvent,
                feelingOrReaction,
                importantContext,
              }),
              signal: abortController.signal,
            });

            if (aiRequestIdRef.current !== currentAiRequestId) return;
            if (res.ok) {
              const data = await res.json();
              if (aiRequestIdRef.current === currentAiRequestId && data.summary) summary = data.summary;
            } else {
              console.warn('Could not generate automatic summary; saving entry without it.');
            }
          } catch (aiErr) {
            if (aiRequestIdRef.current === currentAiRequestId) {
              console.warn('AI summary service error:', aiErr);
            }
          }
        };

        await Promise.race([generateSummaryWork(), deadline]);
        if (aiTimeoutRef.current === timeoutId) {
          clearTimeout(timeoutId);
          aiTimeoutRef.current = null;
        }
        if (aiAbortControllerRef.current === abortController) aiAbortControllerRef.current = null;
        if (aiRequestIdRef.current === currentAiRequestId) setAnalyzing(false);
      }

      if (!isMountedRef.current) return;

      const entryPayload = {
        title: title.trim() || 'Untitled Reflection',
        date,
        content,
        situation,
        behaviorOrEvent,
        feelingOrReaction,
        importantContext,
        summary,
      };

      if (initialEntry?.id) {
        await updateJournalEntry(userId, initialEntry.id, entryPayload);
        onSaveSuccess({ ...initialEntry, ...entryPayload });
      } else {
        const newId = await createJournalEntry(userId, entryPayload);
        onSaveSuccess({ id: newId, userId, ...entryPayload, reflections: [] });
      }

      onClose();
    } catch (err: any) {
      console.error('Error saving journal entry:', err);
      if (isMountedRef.current) {
        setError(err?.message || 'Failed to save reflection to Firestore. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setSaving(false);
        setAnalyzing(false);
        setSaveIntent(null);
      }
    }
  };

  const inputClass =
    'box-border min-h-11 min-w-0 w-full max-w-full rounded-control border border-journal-border bg-journal-panel-2/40 px-3.5 py-2.5 text-base text-journal-ink placeholder:text-journal-ink-faint focus-visible:border-journal-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-journal-accent transition-all sm:text-sm';
  const labelClass = 'mb-2 block text-xs font-medium uppercase tracking-wider text-journal-ink-muted';

  return (
    <div className={presentation === 'modal'
      ? 'fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 backdrop-blur-xs p-0 sm:p-4'
      : 'mx-auto w-full max-w-editor'}>
      <div
        ref={presentation === 'modal' ? dialogRef : undefined}
        role={presentation === 'modal' ? 'dialog' : undefined}
        aria-modal={presentation === 'modal' ? 'true' : undefined}
        aria-labelledby="journal-editor-title"
        aria-describedby="journal-editor-description"
        tabIndex={presentation === 'modal' ? -1 : undefined}
        className={presentation === 'modal'
          ? 'relative flex h-dvh min-w-0 w-full max-w-full flex-col overflow-hidden bg-journal-panel text-journal-ink shadow-dialog sm:my-auto sm:h-auto sm:max-h-[92vh] sm:max-w-editor sm:rounded-feature sm:border sm:border-journal-border'
          : 'relative flex min-w-0 w-full flex-col overflow-hidden rounded-feature border border-journal-border bg-journal-panel text-journal-ink shadow-card'}
      >
        <div inert={discardOpen ? true : undefined} className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex min-w-0 items-start justify-between gap-4 border-b border-journal-border bg-journal-panel px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-journal-accent-bright">
                <PenLine className="h-4 w-4 shrink-0" aria-hidden="true" />
                <h3 id="journal-editor-title" className="min-w-0 [overflow-wrap:anywhere] font-serif text-xl font-semibold text-journal-ink sm:text-2xl">
                  {initialEntry ? 'Edit reflection' : 'Write a reflection'}
                </h3>
              </div>
              <p id="journal-editor-description" className="mt-1 text-sm text-journal-ink-muted">
                Capture what happened in your own words.
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              disabled={saving}
              aria-label="Close reflection editor"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-journal-ink-muted hover:bg-journal-panel-2 hover:text-journal-ink transition-colors disabled:opacity-50"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <div className={presentation === 'modal'
            ? 'min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto'
            : 'min-w-0 overflow-x-clip'}>
            <div className="mx-auto min-w-0 w-full max-w-full space-y-6 px-5 py-6 sm:max-w-editor sm:px-8 sm:py-7">
              {error && (
                <div id="journal-editor-error" role="alert" className="rounded-card border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div role="group" aria-label="Reflection mode" className="flex w-full max-w-xs rounded-control border border-journal-border bg-journal-panel-2/60 p-1 sm:inline-flex sm:w-auto">
                {(['freeform', 'guided'] as EditorMode[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={mode === item}
                    onClick={() => setMode(item)}
                    className={
                      'min-h-10 min-w-0 flex-1 rounded-[7px] px-4 text-sm font-semibold transition-all sm:flex-none ' +
                      (mode === item
                        ? 'bg-journal-panel text-journal-accent-bright shadow-xs border border-journal-accent'
                        : 'text-journal-ink-muted hover:text-journal-ink')
                    }
                  >
                    {item === 'freeform' ? 'Freeform' : 'Guided'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:gap-5">
                <div className="min-w-0">
                  <label htmlFor="entry-title-input" className={labelClass}>Title or focus</label>
                  <input
                    id="entry-title-input"
                    ref={titleInputRef}
                    type="text"
                    aria-invalid={isContentValidationError}
                    aria-describedby={isContentValidationError ? 'journal-editor-error' : undefined}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="What is this reflection about?"
                    className={inputClass}
                  />
                </div>
                <div className="min-w-0">
                  <label htmlFor="entry-date-input" className={labelClass}>Date</label>
                  <input
                    id="entry-date-input"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {mode === 'freeform' ? (
                <div className="min-w-0">
                  <label htmlFor="entry-content-textarea" className={labelClass}>Reflection</label>
                  <textarea
                    id="entry-content-textarea"
                    aria-invalid={isContentValidationError}
                    aria-describedby={isContentValidationError ? 'journal-editor-error' : 'entry-content-help'}
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                    placeholder="Write freely about what happened, what you noticed, and what stayed with you…"
                    className="box-border min-h-72 min-w-0 w-full max-w-full resize-y rounded-card border border-journal-border bg-journal-panel-2/30 px-4 py-4 font-serif text-base leading-relaxed text-journal-ink placeholder:font-serif placeholder:text-journal-ink-faint focus-visible:border-journal-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-journal-accent transition-all sm:min-h-80 sm:p-5 sm:text-lg"
                  />
                  <p id="entry-content-help" className="mt-2 text-xs text-journal-ink-muted">Your writing can be as brief or detailed as you need.</p>
                </div>
              ) : (
                <div className="min-w-0 space-y-5">
                  <div className="min-w-0">
                    <h4 className="font-serif text-lg font-semibold text-journal-ink">Guided reflection</h4>
                    <p className="mt-1 min-w-0 [overflow-wrap:anywhere] text-sm text-journal-ink-muted">Use any prompts that help. Your freeform writing stays saved while you switch modes.</p>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-5">
                    <div className="min-w-0 rounded-card border border-journal-border/80 bg-journal-panel-2/20 p-4">
                      <label htmlFor="entry-situation-input" className={labelClass}>Situation or setting</label>
                      <input id="entry-situation-input" type="text" value={situation} onChange={(event) => setSituation(event.target.value)} placeholder="Where were you, and who was involved?" className={inputClass} />
                    </div>
                    <div className="min-w-0 rounded-card border border-journal-border/80 bg-journal-panel-2/20 p-4">
                      <label htmlFor="entry-behavior-input" className={labelClass}>Specific behavior or event</label>
                      <input id="entry-behavior-input" type="text" value={behaviorOrEvent} onChange={(event) => setBehaviorOrEvent(event.target.value)} placeholder="What actions or words did you observe?" className={inputClass} />
                    </div>
                    <div className="min-w-0 rounded-card border border-journal-border/80 bg-journal-panel-2/20 p-4">
                      <label htmlFor="entry-feeling-input" className={labelClass}>Feelings or reactions</label>
                      <input id="entry-feeling-input" type="text" value={feelingOrReaction} onChange={(event) => setFeelingOrReaction(event.target.value)} placeholder="What did you feel or notice in yourself?" className={inputClass} />
                    </div>
                    <div className="min-w-0 rounded-card border border-journal-border/80 bg-journal-panel-2/20 p-4">
                      <label htmlFor="entry-context-input" className={labelClass}>Important context or assumptions</label>
                      <input id="entry-context-input" type="text" value={importantContext} onChange={(event) => setImportantContext(event.target.value)} placeholder="What background, expectations, or pressures mattered?" className={inputClass} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <footer className="min-w-0 border-t border-journal-border bg-journal-panel px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 sm:px-6 sm:pb-4">
            <div className="mx-auto flex min-w-0 w-full max-w-full flex-col-reverse gap-3 sm:max-w-editor sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={requestClose} disabled={saving} className="min-h-11 rounded-control px-4 text-base font-medium text-journal-ink-muted hover:bg-journal-panel-2 hover:text-journal-ink transition-colors disabled:opacity-50 sm:text-sm">
                Cancel
              </button>
              <div className="flex min-w-0 w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
                <button
                  id="save-analyze-button"
                  type="button"
                  onClick={() => handleSubmit(true)}
                  disabled={saving}
                  className="inline-flex min-h-11 min-w-0 w-full items-center justify-center gap-2 rounded-control border border-journal-border bg-journal-panel-2 px-4 text-center text-base font-semibold text-journal-accent-bright hover:bg-journal-bg hover:border-journal-accent hover:text-journal-ink transition-colors disabled:opacity-50 sm:w-auto sm:text-sm"
                >
                  {saveIntent === 'analyze' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
                  <span>{saveIntent === 'analyze' ? (analyzing ? 'Adding AI observations…' : 'Saving…') : 'Save and add AI observations'}</span>
                </button>
                <button
                  id="save-only-button"
                  type="button"
                  onClick={() => handleSubmit(false)}
                  disabled={saving}
                  className="inline-flex min-h-11 min-w-0 w-full items-center justify-center gap-2 rounded-control bg-accent-primary px-5 text-center text-base font-semibold text-white shadow-xs hover:bg-accent-primary-hover transition-colors disabled:opacity-50 sm:w-auto sm:text-sm"
                >
                  {saveIntent === 'save' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  <span>{saveIntent === 'save' ? 'Saving…' : 'Save reflection'}</span>
                </button>
              </div>
            </div>
          </footer>
        </div>

        {discardOpen && (
          <div className={presentation === 'modal'
            ? 'absolute inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4'
            : 'fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4'}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-description" className="w-full max-w-md rounded-feature border border-journal-border bg-journal-panel p-6 shadow-dialog">
              <h4 id="discard-title" className="font-serif text-xl font-semibold text-journal-ink">Discard this reflection?</h4>
              <p id="discard-description" className="mt-2 text-sm text-journal-ink-muted">You have changes that haven’t been saved.</p>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button ref={continueWritingRef} type="button" onClick={continueWriting} className="min-h-11 rounded-control border border-journal-border bg-journal-panel-2 px-4 text-base font-semibold text-journal-ink hover:bg-journal-bg transition-colors sm:text-sm">
                  Continue writing
                </button>
                <button type="button" onClick={discardChanges} className="min-h-11 rounded-control px-4 text-base font-semibold text-red-600 hover:bg-red-50 transition-colors sm:text-sm">
                  Discard changes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

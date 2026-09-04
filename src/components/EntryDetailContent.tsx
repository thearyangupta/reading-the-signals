import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Calendar, Edit3, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import {
  auth,
  deleteJournalEntry,
  forgetSignal,
  normalizeCandidateSignalText,
  rememberSignal,
  subscribeUserRememberedSignals,
  updateJournalEntry,
} from '../lib/firebase';
import { CandidateSignal, JournalEntry, RememberedSignal } from '../types';
import { ReflectionChat } from './ReflectionChat';
import { SignalGlyph } from './SignalGlyph';

interface EntryDetailContentProps {
  userId: string;
  entry: JournalEntry;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onUpdate: (entry: JournalEntry) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  scrollMode?: 'contained' | 'document';
  /**
   * Slot for a wrapper-owned header action (e.g. the modal's close button),
   * rendered alongside the title/date on the same header row. Intentionally
   * generic (not an onClose callback) so EntryDetailContent has no notion of
   * "closing" anything itself.
   */
  headerAction?: React.ReactNode;
}

/**
 * Imperative handle letting a wrapper (currently only EntryDetailModal)
 * coordinate its own close behavior with this component's internal delete
 * confirmation, without lifting confirmDelete state up or passing a generic
 * onClose callback down.
 */
export interface EntryDetailContentHandle {
  isConfirmingDelete: () => boolean;
  cancelDeleteConfirmation: () => void;
}

const formatEntryDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return date;
  const localDate = new Date(year, month - 1, day);
  if (Number.isNaN(localDate.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(localDate);
};

export const EntryDetailContent = React.forwardRef<EntryDetailContentHandle, EntryDetailContentProps>(
  ({ userId, entry, onEdit, onDelete, onUpdate, scrollContainerRef, scrollMode = 'contained', headerAction }, ref) => {
    const [summarizing, setSummarizing] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [rememberedSignals, setRememberedSignals] = useState<RememberedSignal[]>([]);
    const [pendingSignalKeys, setPendingSignalKeys] = useState<string[]>([]);
    const [signalError, setSignalError] = useState<string | null>(null);
    const cancelDeleteRef = useRef<HTMLButtonElement>(null);
    const deleteButtonRef = useRef<HTMLButtonElement>(null);
    const summaryRequestIdRef = useRef(0);
    const summaryAbortControllerRef = useRef<AbortController | null>(null);
    const summaryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingSignalKeysRef = useRef(new Set<string>());

    const cancelDelete = () => {
      setConfirmDelete(false);
      window.requestAnimationFrame(() => deleteButtonRef.current?.focus());
    };

    useImperativeHandle(ref, () => ({
      isConfirmingDelete: () => confirmDelete,
      cancelDeleteConfirmation: cancelDelete,
    }), [confirmDelete]);

    useEffect(() => {
      if (confirmDelete) cancelDeleteRef.current?.focus();
    }, [confirmDelete]);

    useEffect(() => () => {
      summaryRequestIdRef.current += 1;
      summaryAbortControllerRef.current?.abort();
      if (summaryTimeoutRef.current) clearTimeout(summaryTimeoutRef.current);
    }, []);

    useEffect(() => subscribeUserRememberedSignals(
      userId,
      setRememberedSignals,
      () => setSignalError('Unable to load remembered signals. Please try again.'),
    ), [userId]);

    const candidateIdentity = (candidate: CandidateSignal) =>
      `${entry.id}|${normalizeCandidateSignalText(candidate.text)}`;

    const findRememberedSignal = (candidate: CandidateSignal) => {
      const normalizedText = normalizeCandidateSignalText(candidate.text);
      return rememberedSignals.find((signal) =>
        signal.sourceEntryId === entry.id &&
        normalizeCandidateSignalText(signal.text) === normalizedText
      );
    };

    const handleRememberSignal = async (candidate: CandidateSignal) => {
      const identity = candidateIdentity(candidate);
      if (pendingSignalKeysRef.current.has(identity)) return;

      pendingSignalKeysRef.current.add(identity);
      setPendingSignalKeys((current) => [...current, identity]);
      setSignalError(null);
      try {
        const signalId = await rememberSignal(userId, entry.id, candidate);
        setRememberedSignals((current) => [
          {
            id: signalId,
            sourceEntryId: entry.id,
            text: candidate.text.trim(),
            suggestedAction: candidate.suggestedAction.trim(),
            createdAt: Date.now(),
          },
          ...current.filter((signal) => signal.id !== signalId),
        ]);
      } catch (err) {
        console.error('Failed to remember signal:', err);
        setSignalError('Could not remember this signal. Please try again.');
      } finally {
        pendingSignalKeysRef.current.delete(identity);
        setPendingSignalKeys((current) => current.filter((key) => key !== identity));
      }
    };

    const handleForgetSignal = async (candidate: CandidateSignal, signalId: string) => {
      const identity = candidateIdentity(candidate);
      if (pendingSignalKeysRef.current.has(identity)) return;

      pendingSignalKeysRef.current.add(identity);
      setPendingSignalKeys((current) => [...current, identity]);
      setSignalError(null);
      try {
        await forgetSignal(userId, signalId);
        setRememberedSignals((current) => current.filter((signal) => signal.id !== signalId));
      } catch (err) {
        console.error('Failed to forget signal:', err);
        setSignalError('Could not forget this signal. Please try again.');
      } finally {
        pendingSignalKeysRef.current.delete(identity);
        setPendingSignalKeys((current) => current.filter((key) => key !== identity));
      }
    };

    const handleGenerateSummary = async () => {
      const currentRequestId = ++summaryRequestIdRef.current;
      const abortController = new AbortController();
      summaryAbortControllerRef.current = abortController;
      setSummarizing(true);
      setError(null);
      const timeoutId = setTimeout(() => {
        if (summaryRequestIdRef.current === currentRequestId) {
          summaryRequestIdRef.current += 1;
          abortController.abort();
          summaryAbortControllerRef.current = null;
          summaryTimeoutRef.current = null;
          setError('This took too long. Please try again.');
          setSummarizing(false);
        }
      }, 32000);
      summaryTimeoutRef.current = timeoutId;

      try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
          throw new Error('Please sign in to add AI observations.');
        }
        const idToken = await currentUser.getIdToken();
        if (summaryRequestIdRef.current !== currentRequestId) return;

        const res = await fetch('/api/summarize', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            title: entry.title,
            content: entry.content,
            situation: entry.situation,
            behaviorOrEvent: entry.behaviorOrEvent,
            feelingOrReaction: entry.feelingOrReaction,
            importantContext: entry.importantContext,
          }),
          signal: abortController.signal,
        });

        const data = await res.json().catch(() => ({}));
        if (summaryRequestIdRef.current !== currentRequestId) return;
        if (!res.ok) {
          throw new Error(
            data.details
              ? (data.error || 'Error') + ': ' + data.details
              : data.error || 'Failed to generate structured summary.',
          );
        }

        if (data.summary) {
          const updatedEntry = { ...entry, summary: data.summary };
          await updateJournalEntry(userId, entry.id, { summary: data.summary });
          if (summaryRequestIdRef.current === currentRequestId) onUpdate(updatedEntry);
        }
      } catch (err: any) {
        console.error(err);
        if (summaryRequestIdRef.current === currentRequestId) {
          setError(err?.message || 'Failed to generate summary.');
        }
      } finally {
        if (summaryTimeoutRef.current === timeoutId) {
          clearTimeout(timeoutId);
          summaryTimeoutRef.current = null;
        }
        if (summaryAbortControllerRef.current === abortController) summaryAbortControllerRef.current = null;
        if (summaryRequestIdRef.current === currentRequestId) setSummarizing(false);
      }
    };

    const handleDeleteEntry = async () => {
      try {
        setDeleting(true);
        await deleteJournalEntry(userId, entry.id);
        onDelete(entry.id);
      } catch (err: any) {
        console.error(err);
        setError('Failed to delete entry from Firestore.');
        setDeleting(false);
      }
    };

    const guidedFields = [
      ['Situation or setting', entry.situation],
      ['Specific behavior or event', entry.behaviorOrEvent],
      ['Feelings or reactions', entry.feelingOrReaction],
      ['Important context or assumptions', entry.importantContext],
    ].filter((field) => Boolean(field[1]));

    const summaryFields = entry.summary
      ? [
          ['Situation described', entry.summary.situation],
          ['Relevant behavior or event', entry.summary.behaviorOrEvent],
          ['Expressed feeling or reaction', entry.summary.feelingOrReaction],
          ['Important context', entry.summary.importantContext],
          ['Theme', entry.summary.theme],
          ['Emotional tone', entry.summary.emotionalTone],
          ['Interpretation noted', entry.summary.interpretation],
        ].filter((field) => Boolean(field[1]))
      : [];
    const candidateSignals = Array.isArray(entry.summary?.candidateSignals)
      ? entry.summary.candidateSignals.filter((candidate) =>
          typeof candidate?.text === 'string' &&
          candidate.text.trim().length > 0 &&
          typeof candidate?.suggestedAction === 'string' &&
          candidate.suggestedAction.trim().length > 0
        )
      : [];

    return (
      <>
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-journal-border bg-journal-panel px-4 py-4 sm:px-8 sm:py-5">
          <div className="min-w-0">
            <h3 id="entry-detail-title" className="[overflow-wrap:anywhere] font-serif text-2xl font-semibold leading-tight tracking-tight text-journal-ink sm:text-3xl">
              {entry.title || 'Untitled Reflection'}
            </h3>
            <p id="entry-detail-description" className="mt-2 flex items-center gap-2 text-sm text-journal-ink-faint">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              <time dateTime={entry.date}>{formatEntryDate(entry.date)}</time>
            </p>
          </div>
          {headerAction}
        </header>

        <div
          ref={scrollContainerRef}
          className={scrollMode === 'contained'
            ? 'min-h-0 min-w-0 flex-1 overflow-x-clip overflow-y-auto overscroll-contain'
            : 'min-w-0 overflow-x-clip'}
        >
          <div className="mx-auto min-w-0 w-full max-w-[54rem] space-y-10 px-4 py-6 sm:px-8 sm:py-10">
            {error && (
              <div role="alert" className="rounded-card border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <section aria-labelledby="your-reflection-heading">
              <h4 id="your-reflection-heading" className="text-sm font-semibold text-journal-ink-muted">Your reflection</h4>
              <div className="mt-3 max-w-reading whitespace-pre-wrap [overflow-wrap:anywhere] font-serif text-lg leading-[1.8] text-journal-ink">
                {entry.content || <span className="font-sans text-sm text-journal-ink-faint">No freeform reflection was recorded.</span>}
              </div>
            </section>

            {guidedFields.length > 0 && (
              <section aria-labelledby="guided-details-heading" className="border-t border-journal-border pt-8">
                <h4 id="guided-details-heading" className="font-serif text-lg font-semibold text-journal-ink">Guided details</h4>
                <dl className="mt-5 space-y-5">
                  {guidedFields.map(([label, value]) => (
                    <div key={label} className="grid gap-1 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-5">
                      <dt className="text-sm font-semibold text-journal-ink-muted">{label}</dt>
                      <dd className="[overflow-wrap:anywhere] font-serif text-base leading-relaxed text-journal-ink">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section aria-labelledby="ai-observations-heading" className="border-t border-journal-border pt-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-journal-accent-bright">
                    <SignalGlyph />
                    AI-generated
                  </p>
                  <h4 id="ai-observations-heading" className="mt-1 font-serif text-lg font-semibold text-journal-ink">AI observations</h4>
                </div>
                <button
                  id="regenerate-summary-button"
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={summarizing}
                  className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-control border border-journal-border bg-journal-panel px-3 text-sm font-semibold text-journal-accent-bright hover:bg-journal-panel-2 disabled:opacity-50 sm:self-auto"
                >
                  <RefreshCw className={'h-4 w-4 ' + (summarizing ? 'animate-spin' : '')} aria-hidden="true" />
                  <span>{summarizing ? 'Generating…' : entry.summary ? 'Regenerate observations' : 'Add AI observations'}</span>
                </button>
              </div>

              <div className="mt-4 rounded-feature border border-journal-border border-l-4 border-l-journal-accent/70 bg-journal-panel px-4 py-5 sm:px-6">
                {entry.summary ? (
                  <div className="space-y-5">
                    <dl className="space-y-4">
                      {summaryFields.map(([label, value]) => (
                        <div key={label} className="grid gap-1 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5">
                          <dt className="text-sm font-semibold text-journal-accent-bright">{label}</dt>
                          <dd className="[overflow-wrap:anywhere] text-sm leading-relaxed text-journal-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {Array.isArray(entry.summary.subjects) && entry.summary.subjects.length > 0 && (
                      <div>
                        <p className="text-sm font-semibold text-journal-accent-bright">Explicit subjects and entities</p>
                        <p className="mt-1 [overflow-wrap:anywhere] text-sm leading-relaxed text-journal-ink">
                          {entry.summary.subjects.join(', ')}
                        </p>
                      </div>
                    )}
                    {candidateSignals.length > 0 && (
                      <section aria-labelledby="candidate-signals-heading" className="border-t border-journal-border pt-5">
                        <h5 id="candidate-signals-heading" className="text-sm font-semibold text-journal-accent-bright">
                          Signals you may want to remember
                        </h5>
                        <p className="mt-1 text-xs leading-relaxed text-journal-ink-faint">
                          These are AI suggestions. Nothing is stored as a remembered signal until you choose Remember.
                        </p>
                        {signalError && (
                          <p role="alert" className="mt-3 rounded-control border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            {signalError}
                          </p>
                        )}
                        <ul className="mt-4 space-y-3">
                          {candidateSignals.map((candidate, index) => {
                            const identity = candidateIdentity(candidate);
                            const rememberedSignal = findRememberedSignal(candidate);
                            const pending = pendingSignalKeys.includes(identity);

                            return (
                              <li key={`${identity}-${index}`} className="rounded-card border border-journal-border bg-journal-panel-2 px-4 py-3">
                                <p className="text-sm font-semibold text-journal-ink">{candidate.text}</p>
                                <p className="mt-1 text-sm leading-relaxed text-journal-ink-muted">{candidate.suggestedAction}</p>
                                <div className="mt-3 flex items-center gap-3">
                                  <button
                                    type="button"
                                    disabled={pending}
                                    onClick={() => rememberedSignal
                                      ? handleForgetSignal(candidate, rememberedSignal.id)
                                      : handleRememberSignal(candidate)}
                                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-control border border-journal-border bg-journal-panel px-3 text-sm font-semibold text-journal-accent-bright hover:bg-journal-panel-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                    {pending
                                      ? rememberedSignal ? 'Forgetting…' : 'Remembering…'
                                      : rememberedSignal ? 'Forget' : 'Remember'}
                                  </button>
                                  {rememberedSignal && !pending && (
                                    <span className="text-xs font-medium text-positive">Remembered</span>
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </section>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed text-journal-ink-muted">
                    No AI observations have been added. Your reflection remains complete without them.
                  </p>
                )}
              </div>
            </section>

            <section aria-labelledby="reflection-dialogue-heading" className="border-t border-journal-border pt-8">
              <div className="mb-4">
                <h4 id="reflection-dialogue-heading" className="font-serif text-lg font-semibold text-journal-ink">Reflection dialogue</h4>
                <p className="mt-1 text-sm text-journal-ink-muted">Continue exploring this reflection through conversation.</p>
              </div>
              <ReflectionChat
                userId={userId}
                entry={entry}
                onEntryUpdated={onUpdate}
                scrollContainerRef={scrollContainerRef}
                scrollMode={scrollMode}
              />
            </section>

            <section aria-labelledby="entry-actions-heading" className="border-t border-journal-border pt-6">
              <h4 id="entry-actions-heading" className="sr-only">Reflection actions</h4>
              {confirmDelete ? (
                <div role="group" aria-label={'Delete ' + (entry.title || 'this reflection') + '?'} className="rounded-card border border-red-200 bg-red-50 p-4">
                  <p className="font-semibold text-journal-ink">Delete this reflection?</p>
                  <p className="mt-1 text-sm text-journal-ink-muted">This action cannot be undone.</p>
                  <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row">
                    <button ref={cancelDeleteRef} type="button" onClick={cancelDelete} className="min-h-11 rounded-control border border-journal-border bg-journal-panel px-4 text-base font-semibold text-journal-ink hover:bg-journal-panel-2 sm:text-sm">
                      Cancel
                    </button>
                    <button id="confirm-delete-button" type="button" onClick={handleDeleteEntry} disabled={deleting} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 text-base font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 sm:text-sm">
                      {deleting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                      {deleting ? 'Deleting…' : 'Delete reflection'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button id="edit-entry-button" type="button" onClick={() => onEdit(entry)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-journal-border bg-journal-panel px-4 text-base font-semibold text-journal-ink hover:bg-journal-panel-2 sm:text-sm">
                    <Edit3 className="h-4 w-4" aria-hidden="true" />
                    Edit reflection
                  </button>
                  <button ref={deleteButtonRef} id="delete-entry-button" type="button" onClick={() => setConfirmDelete(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-3 text-base font-medium text-red-600 hover:bg-red-50 sm:text-sm">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Delete reflection
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </>
    );
  },
);

EntryDetailContent.displayName = 'EntryDetailContent';

import React from 'react';
import { JournalEntry, AskJournalResult } from '../types';
import {
  AlertCircle,
  Compass,
  FileText,
  Info,
  Loader2,
  Send,
} from 'lucide-react';

interface AskMyJournalProps {
  targetEntries: JournalEntry[];
  question: string;
  onQuestionChange: (q: string) => void;
  onAskQuestion: () => void;
  result: AskJournalResult | null;
  loading: boolean;
  error: string | null;
  onSelectEntry: (entry: JournalEntry) => void;
}

const SUGGESTED_QUESTIONS = [
  'What recurring themes appear when I write about work?',
  'When did my perspective or reaction start shifting?',
  'What situations triggered the strongest emotional reactions?',
  'What have I written regarding personal boundaries?',
];

export const AskMyJournal: React.FC<AskMyJournalProps> = ({
  targetEntries,
  question,
  onQuestionChange,
  onAskQuestion,
  result,
  loading,
  error,
  onSelectEntry,
}) => {
  const isScopeEmpty = targetEntries.length === 0;
  const isQuestionValid = question.trim().length >= 3 && question.trim().length <= 500;
  const canSubmit = !loading && !isScopeEmpty && isQuestionValid;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSubmit) {
      onAskQuestion();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSubmit) {
        onAskQuestion();
      }
    }
  };

  const handleChipClick = (suggestion: string) => {
    onQuestionChange(suggestion);
  };

  const handleEvidenceClick = (entryId: string) => {
    const match = targetEntries.find((e) => e.id === entryId);
    if (match) {
      onSelectEntry(match);
    }
  };

  return (
    <div id="ask-my-journal-tab" className="space-y-6">
      {/* Purpose */}
      <p className="max-w-reading text-sm leading-relaxed text-text-secondary">
        Ask about something you&rsquo;ve noticed, felt, or written about.
      </p>

      {!isScopeEmpty && (
        <p className="text-xs text-text-muted">
          Using {targetEntries.length} {targetEntries.length === 1 ? 'reflection' : 'reflections'} in your current scope.
        </p>
      )}

      {/* AI provenance */}
      <div className="flex items-start gap-3 rounded-card bg-surface-ai px-4 py-3 text-sm text-text-secondary">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
        <p className="leading-relaxed">
          Answers are based only on the reflections in your current scope, using the structured summaries already created from them. There may not be enough evidence to answer every question. Responses are an AI-generated interpretation, not objective fact &mdash; they do not diagnose, determine hidden motives, or define who you are.
        </p>
      </div>

      {isScopeEmpty ? (
        <div className="space-y-2 border-t border-border py-6 text-center">
          <h4 className="font-serif text-base font-semibold text-text-primary">Add a reflection to ask a question</h4>
          <p className="mx-auto max-w-reading text-sm leading-relaxed text-text-secondary">
            Ask My Journal needs at least one summarized reflection in the current scope before it can answer.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Composer */}
          <div className="space-y-2">
            <label htmlFor="ask-journal-question-input" className="block text-sm font-semibold text-text-primary">
              What would you like to understand?
            </label>
            <textarea
              id="ask-journal-question-input"
              rows={3}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-invalid={question.length > 500}
              aria-describedby="ask-journal-character-count"
              placeholder="Ask about something in your reflections&hellip;"
              disabled={loading}
              className="w-full resize-none rounded-control border border-border bg-surface p-3.5 text-base leading-relaxed text-text-primary placeholder:text-text-muted transition-colors focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary disabled:opacity-60"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span
                id="ask-journal-character-count"
                className={`text-xs ${question.length > 500 ? 'font-semibold text-destructive' : 'text-text-muted'}`}
              >
                {question.length}/500
              </span>
              <button
                type="submit"
                id="ask-journal-submit-btn"
                disabled={!canSubmit}
                className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-text-muted disabled:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus sm:w-auto"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Looking&hellip;</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" aria-hidden="true" />
                    <span>Ask my journal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Suggested questions */}
          <div className="space-y-2">
            <p className="text-sm font-semibold text-text-secondary">Questions you could ask</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleChipClick(suggestion)}
                  disabled={loading}
                  className="min-h-11 max-w-full rounded-control border border-border bg-surface px-3 py-2 text-left text-sm leading-snug text-text-secondary transition-colors hover:border-border-strong hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">I couldn&rsquo;t answer that</p>
            <p className="mt-1 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div role="status" aria-live="polite" className="space-y-2 py-8 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent-primary" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-text-secondary">Looking through your reflections&hellip;</p>
        </div>
      )}

      {/* Answer */}
      {!loading && result && (
        <div className="space-y-6 border-t border-border pt-6">
          <div className="space-y-2">
            <h4 className="font-serif text-lg font-semibold text-text-primary">Answer</h4>
            {!result.hasSufficientEvidence && (
              <p className="text-sm text-text-muted">
                Not enough evidence in this scope to fully answer this question.
              </p>
            )}
            <p className="whitespace-pre-line font-serif text-base leading-relaxed text-text-primary">
              {result.answer}
            </p>
          </div>

          {Array.isArray(result.evidence) && result.evidence.length > 0 && (
            <div className="space-y-3 border-t border-border pt-4">
              <h5 className="font-serif text-base font-semibold text-text-primary">From your reflections</h5>
              <div className="space-y-3">
                {result.evidence.map((ev, evIdx) => {
                  const resolvable = targetEntries.some((e) => e.id === ev.entryId);
                  return (
                    <article key={evIdx} className="min-w-0 space-y-2 rounded-card border border-border bg-surface p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <span className="min-w-0 [overflow-wrap:anywhere] font-serif text-base font-semibold text-text-primary">
                          {ev.title}
                        </span>
                        {ev.date && <span className="shrink-0 text-xs text-text-muted">{ev.date}</span>}
                      </div>
                      {ev.reason && (
                        <p className="text-sm leading-relaxed text-text-secondary">{ev.reason}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEvidenceClick(ev.entryId)}
                        disabled={!resolvable}
                        className="inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-semibold text-accent-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                      >
                        <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{resolvable ? 'View reflection' : 'Not available in this scope'}</span>
                      </button>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {result.clarificationQuestion && (
            <div className="space-y-1 border-t border-border pt-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                <Compass className="h-4 w-4 shrink-0 text-accent-primary" aria-hidden="true" />
                <span>A question to sit with</span>
              </div>
              <p className="font-serif text-base italic leading-relaxed text-text-primary">
                {result.clarificationQuestion}
              </p>
            </div>
          )}

          {result.message && (
            <p className="border-t border-border pt-4 text-sm italic leading-relaxed text-text-muted">
              {result.message}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

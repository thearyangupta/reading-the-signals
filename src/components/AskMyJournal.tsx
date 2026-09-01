import React from 'react';
import { JournalEntry, AskJournalResult } from '../types';
import {
  Compass,
  Sparkles,
  Loader2,
  Calendar,
  ChevronRight,
  FileText,
  AlertCircle,
  HelpCircle,
  Send,
  Info,
  ShieldCheck,
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
      {/* Overview & Purpose Banner */}
      <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-5 text-stone-800 space-y-2.5">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-amber-100/80 text-amber-800 rounded-lg">
            <Compass className="w-4 h-4 text-amber-800" />
          </div>
          <h4 className="text-sm font-serif font-bold text-stone-900 tracking-tight">
            Ask My Journal (Grounded Synthesis)
          </h4>
        </div>
        <p className="text-xs text-stone-600 leading-relaxed">
          Ask natural-language questions about your reflections. Answers are synthesized strictly from the structured signals in your active scope ({targetEntries.length} {targetEntries.length === 1 ? 'entry' : 'entries'}), without diagnostic assumptions or general world knowledge.
        </p>
      </div>

      {/* Scope Warning if 0 entries */}
      {isScopeEmpty ? (
        <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-5 text-center space-y-2">
          <AlertCircle className="w-5 h-5 text-amber-700 mx-auto" />
          <h5 className="text-xs font-serif font-semibold text-stone-800">
            No Structured Entries in Active Scope
          </h5>
          <p className="text-[11px] text-stone-500 max-w-md mx-auto leading-relaxed">
            Ask My Journal requires at least 1 reflection with a structured summary in the active scope. Please record reflections or adjust your scope selection above.
          </p>
        </div>
      ) : (
        /* Question Form */
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative bg-white rounded-xl border border-stone-200 shadow-2xs focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-600 transition-all">
            <textarea
              id="ask-journal-question-input"
              rows={3}
              value={question}
              onChange={(e) => onQuestionChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your journal (e.g. When did I start feeling differently about work?)..."
              disabled={loading}
              className="w-full p-3.5 pb-10 text-xs text-stone-900 placeholder:text-stone-400 bg-transparent resize-none focus:outline-none disabled:opacity-50"
            />
            <div className="absolute bottom-2.5 left-3.5 right-3.5 flex items-center justify-between">
              <span className={`text-[10px] ${question.length > 500 ? 'text-rose-600 font-semibold' : 'text-stone-400'}`}>
                {question.length}/500 chars
              </span>
              <button
                type="submit"
                id="ask-journal-submit-btn"
                disabled={!canSubmit}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-amber-800 hover:bg-amber-900 active:bg-amber-950 disabled:bg-stone-200 disabled:text-stone-400 text-white text-xs font-medium rounded-lg shadow-2xs transition-all cursor-pointer disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Ask Journal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Suggestion Chips */}
          <div className="space-y-1.5 pt-1">
            <p className="text-[11px] font-medium text-stone-500 flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-amber-600" />
              <span>Suggested Explorations:</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((suggestion, sIdx) => (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => handleChipClick(suggestion)}
                  disabled={loading}
                  className="text-left text-xs bg-stone-50 hover:bg-amber-50/70 border border-stone-200/80 hover:border-amber-300 text-stone-700 hover:text-stone-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </form>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start space-x-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Query Analysis Error</p>
            <p className="leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Loading Placeholder */}
      {loading && (
        <div className="bg-stone-50/80 border border-stone-200/70 rounded-xl p-8 text-center space-y-3">
          <Loader2 className="w-6 h-6 text-amber-700 animate-spin mx-auto" />
          <div className="space-y-1">
            <h5 className="text-xs font-serif font-semibold text-stone-800">
              Synthesizing Grounded Reflections...
            </h5>
            <p className="text-[11px] text-stone-500 max-w-sm mx-auto">
              Examining structured signals across {targetEntries.length} active reflection {targetEntries.length === 1 ? 'entry' : 'entries'} to construct an evidence-led answer.
            </p>
          </div>
        </div>
      )}

      {/* Result Card */}
      {!loading && result && (
        <div className="bg-stone-50/70 border border-stone-200 rounded-xl p-5 space-y-5 shadow-2xs">
          {/* Answer Section */}
          <div className="space-y-2">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-stone-800">
              <Compass className="w-4 h-4 text-amber-700" />
              <span>Grounded Answer</span>
              {!result.hasSufficientEvidence && (
                <span className="text-[10px] bg-amber-100 text-amber-850 px-1.5 py-0.5 rounded font-medium ml-2">
                  Insufficient Evidence
                </span>
              )}
            </div>
            <div className="bg-white p-4 rounded-xl border border-stone-200/90 text-xs text-stone-800 leading-relaxed whitespace-pre-line shadow-2xs">
              {result.answer}
            </div>
          </div>

          {/* Evidence Citations */}
          {Array.isArray(result.evidence) && result.evidence.length > 0 && (
            <div className="space-y-2.5 pt-1 border-t border-stone-200/60">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-stone-800 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  <span>Supporting Evidence ({result.evidence.length})</span>
                </span>
                <span className="text-[10px] text-stone-400">
                  Click to open reflection
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {result.evidence.map((ev, evIdx) => {
                  const resolvable = targetEntries.some((e) => e.id === ev.entryId);
                  return (
                    <button
                      key={evIdx}
                      type="button"
                      onClick={() => handleEvidenceClick(ev.entryId)}
                      disabled={!resolvable}
                      className={`text-left p-3 rounded-xl border transition-all text-xs space-y-1.5 shadow-2xs ${
                        resolvable
                          ? 'bg-white hover:bg-stone-100/80 border-stone-200 text-stone-800 cursor-pointer group'
                          : 'bg-stone-100/60 border-stone-200 text-stone-400 cursor-not-allowed opacity-70'
                      }`}
                      title={resolvable ? 'Click to view reflection details' : 'Entry not available in active scope'}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 font-medium truncate max-w-[180px]">
                          <Calendar className="w-3 h-3 text-stone-400 group-hover:text-stone-600 shrink-0" />
                          <span className="truncate">{ev.title}</span>
                        </div>
                        {ev.date && (
                          <span className="text-[10px] text-stone-400 font-mono shrink-0">
                            {ev.date}
                          </span>
                        )}
                      </div>
                      {ev.reason && (
                        <p className="text-[11px] text-stone-600 leading-snug line-clamp-2">
                          {ev.reason}
                        </p>
                      )}
                      <div className="flex items-center justify-end text-[10px] text-amber-850 font-medium pt-0.5">
                        <span>View Entry</span>
                        <ChevronRight className="w-3 h-3 ml-0.5" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Clarification Reflection Question */}
          {result.clarificationQuestion && (
            <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 space-y-1 flex items-start space-x-2.5 shadow-2xs">
              <HelpCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-amber-950">Reflective Follow-Up:</span>
                <p className="text-stone-700 leading-relaxed italic">
                  &ldquo;{result.clarificationQuestion}&rdquo;
                </p>
              </div>
            </div>
          )}

          {/* Optional Message */}
          {result.message && (
            <div className="text-[11px] text-stone-500 italic bg-white/80 p-2.5 rounded-lg border border-stone-200/60">
              {result.message}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

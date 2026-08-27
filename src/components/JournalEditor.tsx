import React, { useState } from 'react';
import { JournalEntry, StructuredSummary } from '../types';
import { createJournalEntry, updateJournalEntry } from '../lib/firebase';
import { Sparkles, Calendar, BookOpen, Heart, Eye, HelpCircle, X, Loader2, Save } from 'lucide-react';

interface JournalEditorProps {
  userId: string;
  initialEntry?: JournalEntry | null;
  onClose: () => void;
  onSaveSuccess: (entry: Partial<JournalEntry>) => void;
}

export const JournalEditor: React.FC<JournalEditorProps> = ({
  userId,
  initialEntry,
  onClose,
  onSaveSuccess,
}) => {
  const [title, setTitle] = useState(initialEntry?.title || '');
  const [date, setDate] = useState(initialEntry?.date || new Date().toISOString().split('T')[0]);
  const [content, setContent] = useState(initialEntry?.content || '');
  const [situation, setSituation] = useState(initialEntry?.situation || '');
  const [behaviorOrEvent, setBehaviorOrEvent] = useState(initialEntry?.behaviorOrEvent || '');
  const [feelingOrReaction, setFeelingOrReaction] = useState(initialEntry?.feelingOrReaction || '');
  const [importantContext, setImportantContext] = useState(initialEntry?.importantContext || '');
  
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (generateSummary: boolean) => {
    if (!title.trim() && !content.trim()) {
      setError('Please provide at least a title or some reflection content.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      let summary: StructuredSummary | null = initialEntry?.summary || null;

      // Request structured summary from server-side Gemini endpoint
      if (generateSummary) {
        setAnalyzing(true);
        try {
          const res = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              content,
              situation,
              behaviorOrEvent,
              feelingOrReaction,
              importantContext,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            if (data.summary) {
              summary = data.summary;
            }
          } else {
            console.warn('Could not generate automatic summary; saving entry without it.');
          }
        } catch (aiErr) {
          console.warn('AI summary service error:', aiErr);
        } finally {
          setAnalyzing(false);
        }
      }

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
      setError(err?.message || 'Failed to save reflection to Firestore. Please try again.');
    } finally {
      setSaving(false);
      setAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full border border-stone-200/90 shadow-xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-stone-200/80 flex items-center justify-between bg-[#FCFAF7]">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-stone-900 text-stone-100 rounded-lg">
              <BookOpen className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-stone-900 text-base">
                {initialEntry ? 'Edit Reflection Entry' : 'New Reflection Entry'}
              </h3>
              <p className="text-xs text-stone-500">Record observations and explore what you noticed</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Title & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Title / Focus Topic
              </label>
              <input
                id="entry-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Challenging review discussion"
                className="w-full text-sm px-3.5 py-2.5 bg-stone-50/60 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-500" /> Date
              </label>
              <input
                id="entry-date-input"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 bg-stone-50/60 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
              />
            </div>
          </div>

          {/* Main Freeform Reflection */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Reflection Narrative
            </label>
            <textarea
              id="entry-content-textarea"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What happened? Describe your thoughts, internal dialogue, and the unfolding experience freely..."
              className="w-full text-sm px-3.5 py-2.5 bg-stone-50/60 border border-stone-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900 leading-relaxed resize-y"
            />
          </div>

          {/* Structured Observation Prompts */}
          <div className="border-t border-stone-100 pt-4">
            <h4 className="text-xs font-semibold text-stone-800 uppercase tracking-wider mb-3">
              Guided Observation Breakdown
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Situation */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-stone-500" /> The Situation / Setting
                </label>
                <input
                  id="entry-situation-input"
                  type="text"
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  placeholder="Where were you? Who was involved?"
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
                />
              </div>

              {/* Behavior / Event */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-stone-500" /> Specific Behavior or Event
                </label>
                <input
                  id="entry-behavior-input"
                  type="text"
                  value={behaviorOrEvent}
                  onChange={(e) => setBehaviorOrEvent(e.target.value)}
                  placeholder="What specific actions or words were observed?"
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
                />
              </div>

              {/* Feelings / Reaction */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-stone-500" /> Your Feelings or Reactions
                </label>
                <input
                  id="entry-feeling-input"
                  type="text"
                  value={feelingOrReaction}
                  onChange={(e) => setFeelingOrReaction(e.target.value)}
                  placeholder="What did you feel? (e.g. anxious, excited, defensive)"
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
                />
              </div>

              {/* Context */}
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-stone-500" /> Important Context or Assumptions
                </label>
                <input
                  id="entry-context-input"
                  type="text"
                  value={importantContext}
                  onChange={(e) => setImportantContext(e.target.value)}
                  placeholder="Any background pressures, past history, or expectations?"
                  className="w-full text-xs px-3 py-2 bg-stone-50/60 border border-stone-200 rounded-lg focus:bg-white focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-5 sm:px-6 py-4 border-t border-stone-200/80 bg-[#FCFAF7] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-[11px] text-stone-500 order-2 sm:order-1">
            Data is stored securely in your isolated Firestore collection.
          </p>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              id="cancel-editor-button"
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              id="save-only-button"
              type="button"
              onClick={() => handleSubmit(false)}
              disabled={saving}
              className="px-3.5 py-2 text-xs font-medium bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg transition-all border border-stone-200/80 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-stone-600" />
              <span>Save Entry</span>
            </button>

            <button
              id="save-analyze-button"
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="px-4 py-2 text-xs font-medium bg-stone-900 hover:bg-stone-800 text-white rounded-lg transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {analyzing || saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-300" />
                  <span>{analyzing ? 'Generating AI Summary...' : 'Saving...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Save & Generate AI Summary</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { JournalEntry, StructuredSummary } from '../types';
import { updateJournalEntry, deleteJournalEntry } from '../lib/firebase';
import { ReflectionChat } from './ReflectionChat';
import {
  Calendar,
  Sparkles,
  Eye,
  Heart,
  BookOpen,
  HelpCircle,
  X,
  Trash2,
  Edit3,
  Loader2,
  RefreshCw,
  Tag,
  Smile,
  Compass,
  Users,
} from 'lucide-react';

interface EntryDetailModalProps {
  userId: string;
  entry: JournalEntry;
  onClose: () => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onUpdate: (entry: JournalEntry) => void;
}

export const EntryDetailModal: React.FC<EntryDetailModalProps> = ({
  userId,
  entry,
  onClose,
  onEdit,
  onDelete,
  onUpdate,
}) => {
  const [summarizing, setSummarizing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    try {
      setSummarizing(true);
      setError(null);

      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: entry.title,
          content: entry.content,
          situation: entry.situation,
          behaviorOrEvent: entry.behaviorOrEvent,
          feelingOrReaction: entry.feelingOrReaction,
          importantContext: entry.importantContext,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate structured summary.');
      }

      const data = await res.json();
      if (data.summary) {
        const updatedEntry = { ...entry, summary: data.summary };
        await updateJournalEntry(userId, entry.id, { summary: data.summary });
        onUpdate(updatedEntry);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to generate summary.');
    } finally {
      setSummarizing(false);
    }
  };

  const handleDeleteEntry = async () => {
    try {
      setDeleting(true);
      await deleteJournalEntry(userId, entry.id);
      onDelete(entry.id);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError('Failed to delete entry from Firestore.');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-stone-200/90 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Modal Top Bar */}
        <div className="px-5 sm:px-6 py-3.5 border-b border-stone-200/80 flex items-center justify-between bg-[#FCFAF7]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 bg-stone-900 text-white rounded-lg">
              <BookOpen className="w-4 h-4 text-amber-300" />
            </div>
            <div>
              <h3 className="font-serif font-semibold text-stone-900 text-base leading-tight">
                {entry.title || 'Untitled Reflection'}
              </h3>
              <div className="flex items-center space-x-2 text-[11px] text-stone-500">
                <Calendar className="w-3 h-3 text-stone-400" />
                <span>{entry.date}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              id="edit-entry-button"
              onClick={() => onEdit(entry)}
              className="p-2 text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
              title="Edit Entry"
            >
              <Edit3 className="w-4 h-4" />
            </button>

            {confirmDelete ? (
              <div className="flex items-center space-x-1 bg-red-50 p-1 rounded-lg border border-red-200">
                <button
                  id="confirm-delete-button"
                  onClick={handleDeleteEntry}
                  disabled={deleting}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded font-medium cursor-pointer"
                >
                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Confirm'}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-1.5 py-1 text-xs text-stone-500 hover:text-stone-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                id="delete-entry-button"
                onClick={() => setConfirmDelete(true)}
                className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Delete Entry"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <div className="h-4 w-px bg-stone-200 mx-1" />

            <button
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-5 sm:p-6 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Reflection Details & Structured Summary (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {error}
              </div>
            )}

            {/* Narrative Content */}
            {entry.content && (
              <div className="bg-stone-50/50 p-4 rounded-xl border border-stone-200/60">
                <h4 className="text-xs font-semibold text-stone-700 uppercase tracking-wider mb-2">
                  Reflection Narrative
                </h4>
                <p className="text-xs sm:text-sm text-stone-800 leading-relaxed whitespace-pre-wrap font-sans">
                  {entry.content}
                </p>
              </div>
            )}

            {/* Structured 4-Point AI Summary */}
            <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs">
              <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-2">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <h4 className="text-xs font-semibold text-stone-900 tracking-tight">
                    Structured Reflection Summary
                  </h4>
                </div>

                <button
                  id="regenerate-summary-button"
                  onClick={handleGenerateSummary}
                  disabled={summarizing}
                  className="flex items-center space-x-1 text-[11px] text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200/70 px-2.5 py-1 rounded-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${summarizing ? 'animate-spin text-amber-600' : ''}`} />
                  <span>{summarizing ? 'Analyzing...' : entry.summary ? 'Regenerate' : 'Generate Summary'}</span>
                </button>
              </div>

              {entry.summary ? (
                <div className="space-y-3 text-xs">
                  {/* 1. Situation */}
                  <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                    <div className="flex items-center space-x-1.5 text-stone-600 font-medium mb-1">
                      <Eye className="w-3.5 h-3.5 text-stone-500" />
                      <span>1. Situation Described</span>
                    </div>
                    <p className="text-stone-800 pl-5 leading-relaxed">{entry.summary.situation}</p>
                  </div>

                  {/* 2. Relevant Behavior or Event */}
                  <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                    <div className="flex items-center space-x-1.5 text-stone-600 font-medium mb-1">
                      <BookOpen className="w-3.5 h-3.5 text-stone-500" />
                      <span>2. Relevant Behavior or Event</span>
                    </div>
                    <p className="text-stone-800 pl-5 leading-relaxed">{entry.summary.behaviorOrEvent}</p>
                  </div>

                  {/* 3. User's Expressed Feeling or Reaction */}
                  <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                    <div className="flex items-center space-x-1.5 text-stone-600 font-medium mb-1">
                      <Heart className="w-3.5 h-3.5 text-rose-500" />
                      <span>3. Expressed Feeling or Reaction</span>
                    </div>
                    <p className="text-stone-800 pl-5 leading-relaxed">{entry.summary.feelingOrReaction}</p>
                  </div>

                  {/* 4. Important Context */}
                  <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                    <div className="flex items-center space-x-1.5 text-stone-600 font-medium mb-1">
                      <HelpCircle className="w-3.5 h-3.5 text-stone-500" />
                      <span>4. Important Context</span>
                    </div>
                    <p className="text-stone-800 pl-5 leading-relaxed">{entry.summary.importantContext}</p>
                  </div>

                  {/* Extended Foundation Fields: Theme & Emotional Tone */}
                  {(entry.summary.theme || entry.summary.emotionalTone) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {entry.summary.theme && (
                        <div className="bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60">
                          <div className="flex items-center space-x-1.5 text-amber-800 font-medium mb-1">
                            <Tag className="w-3.5 h-3.5 text-amber-600" />
                            <span>5. Theme</span>
                          </div>
                          <p className="text-stone-800 pl-5 leading-relaxed font-medium">{entry.summary.theme}</p>
                        </div>
                      )}
                      {entry.summary.emotionalTone && (
                        <div className="bg-rose-50/40 p-2.5 rounded-lg border border-rose-200/60">
                          <div className="flex items-center space-x-1.5 text-rose-800 font-medium mb-1">
                            <Smile className="w-3.5 h-3.5 text-rose-500" />
                            <span>6. Emotional Tone</span>
                          </div>
                          <p className="text-stone-800 pl-5 leading-relaxed">{entry.summary.emotionalTone}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Extended Foundation Field: Interpretation */}
                  {entry.summary.interpretation && (
                    <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                      <div className="flex items-center space-x-1.5 text-stone-600 font-medium mb-1">
                        <Compass className="w-3.5 h-3.5 text-stone-500" />
                        <span>7. User Stated Interpretation</span>
                      </div>
                      <p className="text-stone-800 pl-5 leading-relaxed italic">{entry.summary.interpretation}</p>
                    </div>
                  )}

                  {/* Extended Foundation Field: Subjects */}
                  {Array.isArray(entry.summary.subjects) && entry.summary.subjects.length > 0 && (
                    <div className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                      <div className="flex items-center space-x-1.5 text-stone-600 font-medium mb-1.5">
                        <Users className="w-3.5 h-3.5 text-stone-500" />
                        <span>8. Explicit Subjects & Entities</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-5">
                        {entry.summary.subjects.map((sub, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center text-[11px] font-medium bg-white text-stone-700 border border-stone-200 px-2 py-0.5 rounded-md"
                          >
                            {sub}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 px-4 bg-stone-50/60 rounded-lg border border-dashed border-stone-200 text-stone-500 text-xs">
                  <Sparkles className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                  <p className="font-medium text-stone-700">No structured summary generated yet.</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Click &apos;Generate Summary&apos; to extract the situation, behavior, feelings, and context.
                  </p>
                </div>
              )}
            </div>

            {/* Raw Observation fields (if present and distinct) */}
            {(entry.situation || entry.behaviorOrEvent || entry.feelingOrReaction || entry.importantContext) && (
              <div className="bg-stone-50/40 rounded-xl p-3.5 border border-stone-200/50 text-[11px] text-stone-600 space-y-1.5">
                <span className="font-medium text-stone-800 block text-xs">Raw Entry Observations:</span>
                {entry.situation && <p><strong className="text-stone-700">Setting:</strong> {entry.situation}</p>}
                {entry.behaviorOrEvent && <p><strong className="text-stone-700">Event:</strong> {entry.behaviorOrEvent}</p>}
                {entry.feelingOrReaction && <p><strong className="text-stone-700">Reaction:</strong> {entry.feelingOrReaction}</p>}
                {entry.importantContext && <p><strong className="text-stone-700">Context:</strong> {entry.importantContext}</p>}
              </div>
            )}
          </div>

          {/* Right Column: Multi-Turn Reflection Dialogue (5 cols) */}
          <div className="lg:col-span-5 h-full flex flex-col">
            <ReflectionChat
              userId={userId}
              entry={entry}
              onEntryUpdated={onUpdate}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

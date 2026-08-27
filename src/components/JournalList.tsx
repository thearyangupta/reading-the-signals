import React, { useState, useMemo } from 'react';
import { JournalEntry } from '../types';
import {
  Calendar,
  Search,
  MessageSquare,
  Sparkles,
  Plus,
  ArrowUpRight,
  BookOpen,
  Eye,
  Heart,
} from 'lucide-react';

interface JournalListProps {
  entries: JournalEntry[];
  loading: boolean;
  onSelectEntry: (entry: JournalEntry) => void;
  onNewEntry: () => void;
}

export const JournalList: React.FC<JournalListProps> = ({
  entries,
  loading,
  onSelectEntry,
  onNewEntry,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.situation?.toLowerCase().includes(q) ||
        e.behaviorOrEvent?.toLowerCase().includes(q) ||
        e.feelingOrReaction?.toLowerCase().includes(q) ||
        e.summary?.situation?.toLowerCase().includes(q) ||
        e.summary?.feelingOrReaction?.toLowerCase().includes(q) ||
        e.summary?.theme?.toLowerCase().includes(q) ||
        e.summary?.emotionalTone?.toLowerCase().includes(q) ||
        e.summary?.interpretation?.toLowerCase().includes(q) ||
        e.summary?.subjects?.some((s) => s.toLowerCase().includes(q))
    );
  }, [entries, searchQuery]);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-800 rounded-full animate-spin mx-auto" />
        <p className="text-xs text-stone-500 font-medium">Loading your private reflection journal...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Controls: Search and Stats */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="journal-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search entries, observations, feelings..."
            className="w-full text-xs sm:text-sm pl-9 pr-4 py-2 bg-white border border-stone-200/90 rounded-xl focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-900 shadow-2xs"
          />
        </div>

        <div className="flex items-center space-x-2 text-xs text-stone-500 justify-between sm:justify-end">
          <span>
            {filteredEntries.length} {filteredEntries.length === 1 ? 'reflection' : 'reflections'}
          </span>
          <button
            id="create-reflection-quick-btn"
            onClick={onNewEntry}
            className="flex items-center space-x-1.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Write Reflection</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white border border-stone-200/80 rounded-2xl p-8 sm:p-12 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center mx-auto text-stone-500 mb-4">
            <BookOpen className="w-6 h-6 text-stone-600" />
          </div>
          <h3 className="text-base font-serif font-semibold text-stone-900 mb-1">
            {searchQuery ? 'No matching reflections found' : 'Your reflection journal is empty'}
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed max-w-sm mx-auto mb-6">
            {searchQuery
              ? 'Try adjusting your search terms or clearing the filter.'
              : 'Take a quiet moment to record a situation, examine how you responded, and explore your observations.'}
          </p>

          <button
            id="start-first-reflection-button"
            onClick={onNewEntry}
            className="inline-flex items-center space-x-2 bg-stone-900 hover:bg-stone-800 text-white text-xs sm:text-sm font-medium py-2.5 px-4 rounded-xl transition-all shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Start a Reflection</span>
          </button>
        </div>
      ) : (
        /* Journal Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map((entry) => {
            const hasReflections = entry.reflections && entry.reflections.length > 0;
            return (
              <div
                key={entry.id}
                id={`journal-card-${entry.id}`}
                onClick={() => onSelectEntry(entry)}
                className="group bg-white rounded-2xl border border-stone-200/80 p-5 shadow-2xs hover:shadow-md hover:border-stone-300 transition-all duration-200 flex flex-col justify-between cursor-pointer relative"
              >
                <div>
                  {/* Top metadata */}
                  <div className="flex items-center justify-between text-[11px] text-stone-500 mb-2.5">
                    <span className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      <span>{entry.date}</span>
                    </span>

                    {entry.summary && (
                      <span className="flex items-center space-x-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md text-[10px] font-medium border border-amber-200/50">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Analyzed</span>
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="font-serif font-semibold text-stone-900 text-base mb-2 group-hover:text-amber-900 transition-colors line-clamp-1">
                    {entry.title || 'Untitled Reflection'}
                  </h3>

                  {/* Summary / Content Snippet */}
                  <p className="text-xs text-stone-600 leading-relaxed line-clamp-3 mb-4 font-sans">
                    {entry.summary
                      ? entry.summary.situation || entry.summary.behaviorOrEvent
                      : entry.content || entry.situation || 'No narrative recorded.'}
                  </p>

                  {/* Extracted Highlights */}
                  {entry.summary && (
                    <div className="space-y-1.5 border-t border-stone-100 pt-3 text-[11px]">
                      {entry.summary.feelingOrReaction && (
                        <div className="flex items-start space-x-1.5 text-stone-700">
                          <Heart className="w-3 h-3 text-rose-500 shrink-0 mt-0.5" />
                          <span className="line-clamp-1 text-stone-600 font-normal">
                            <strong className="text-stone-800 font-medium">Feeling:</strong>{' '}
                            {entry.summary.feelingOrReaction}
                          </span>
                        </div>
                      )}
                      {entry.summary.behaviorOrEvent && (
                        <div className="flex items-start space-x-1.5 text-stone-700">
                          <Eye className="w-3 h-3 text-stone-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-1 text-stone-600 font-normal">
                            <strong className="text-stone-800 font-medium">Observed:</strong>{' '}
                            {entry.summary.behaviorOrEvent}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
                  <span className="flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3 text-stone-400" />
                    <span>
                      {hasReflections
                        ? `${entry.reflections.length} ${entry.reflections.length === 1 ? 'exchange' : 'exchanges'}`
                        : 'No AI dialogue yet'}
                    </span>
                  </span>

                  <span className="flex items-center space-x-0.5 text-stone-700 font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Reflect</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-800" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

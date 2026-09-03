import React, { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { JournalEntry } from '../types';
import { EntryDetailContent } from './EntryDetailContent';

interface EntryDetailPageProps {
  userId: string;
  entry: JournalEntry;
  onBack: () => void;
  onEdit: (entry: JournalEntry) => void;
  onDelete: (entryId: string) => void;
  onUpdate: (entry: JournalEntry) => void;
}

export const EntryDetailPage: React.FC<EntryDetailPageProps> = ({
  userId,
  entry,
  onBack,
  onEdit,
  onDelete,
  onUpdate,
}) => {
  const pageRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const focusedEntryIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (focusedEntryIdRef.current === entry.id) return;

    const heading = pageRef.current?.querySelector<HTMLElement>('#entry-detail-title');
    if (!heading) return;

    heading.tabIndex = -1;
    heading.focus();
    focusedEntryIdRef.current = entry.id;
  }, [entry.id]);

  return (
    <div
      ref={pageRef}
      className="flex min-w-0 flex-col overflow-hidden rounded-feature border border-border bg-surface shadow-card"
    >
      <EntryDetailContent
        userId={userId}
        entry={entry}
        onEdit={onEdit}
        onDelete={onDelete}
        onUpdate={onUpdate}
        scrollContainerRef={scrollContainerRef}
        scrollMode="document"
        headerAction={
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control px-3 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-subtle hover:text-text-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to Journal</span>
            <span className="sm:hidden">Back</span>
          </button>
        }
      />
    </div>
  );
};

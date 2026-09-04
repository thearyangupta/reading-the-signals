import React, { useRef } from 'react';
import { X } from 'lucide-react';
import { useDialogAccessibility } from '../hooks/useDialogAccessibility';
import { JournalEntry } from '../types';
import { EntryDetailContent, EntryDetailContentHandle } from './EntryDetailContent';

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
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<EntryDetailContentHandle>(null);

  const handleDialogClose = () => {
    if (contentRef.current?.isConfirmingDelete()) {
      contentRef.current.cancelDeleteConfirmation();
      return;
    }
    onClose();
  };
  const dialogRef = useDialogAccessibility(handleDialogClose, closeButtonRef);

  // Preserve the original modal's "close after a successful delete" behavior
  // (EntryDetailContent only ever calls this on success, never from its
  // catch block, so this still only fires when the delete actually succeeded).
  const handleDelete = (entryId: string) => {
    onDelete(entryId);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-text-primary/45 p-0 sm:p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-detail-title"
        aria-describedby="entry-detail-description"
        tabIndex={-1}
        className="animate-settle-in flex h-dvh min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-surface shadow-dialog sm:my-auto sm:h-[calc(100dvh-2rem)] sm:max-h-[52rem] sm:max-w-[60rem] sm:rounded-feature sm:border sm:border-border"
      >
        <EntryDetailContent
          ref={contentRef}
          userId={userId}
          entry={entry}
          onEdit={onEdit}
          onDelete={handleDelete}
          onUpdate={onUpdate}
          scrollContainerRef={bodyScrollRef}
          headerAction={
            <button
              ref={closeButtonRef}
              type="button"
              onClick={onClose}
              aria-label="Close reflection details"
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-control text-text-muted hover:bg-surface-subtle hover:text-text-primary"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          }
        />
      </div>
    </div>
  );
};

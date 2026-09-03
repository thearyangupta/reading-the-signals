import React, { useRef } from 'react';
import { JournalEntry } from '../types';
import { JournalEditor } from './JournalEditor';

interface JournalEditorPageProps {
  userId: string;
  onCancel: () => void;
  onSaveSuccess: (entry: Partial<JournalEntry>) => void;
}

export const JournalEditorPage: React.FC<JournalEditorPageProps> = ({
  userId,
  onCancel,
  onSaveSuccess,
}) => {
  const saveCompletedRef = useRef(false);

  return (
    <JournalEditor
      userId={userId}
      presentation="page"
      onSaveSuccess={(entry) => {
        saveCompletedRef.current = true;
        onSaveSuccess(entry);
      }}
      onClose={() => {
        if (!saveCompletedRef.current) onCancel();
      }}
    />
  );
};

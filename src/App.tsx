import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signOutUser, subscribeUserEntries } from './lib/firebase';
import { UserProfile, JournalEntry } from './types';
import { Navbar } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { JournalList } from './components/JournalList';
import { JournalEditor } from './components/JournalEditor';
import { EntryDetailModal } from './components/EntryDetailModal';
import { PatternAnalysisSection } from './components/PatternAnalysisSection';
import { Sparkles, Shield, AlertCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal / View states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isAnonymous: firebaseUser.isAnonymous,
        });
      } else {
        setUser(null);
        setEntries([]);
        setSelectedEntry(null);
        setEditorOpen(false);
        setEditingEntry(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to isolated real-time Firestore entries for the authenticated user
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setEntriesLoading(false);
      return;
    }

    setEntriesLoading(true);
    const unsubscribe = subscribeUserEntries(
      user.uid,
      (updatedEntries) => {
        setEntries(updatedEntries);
        setEntriesLoading(false);
        // If an active modal entry was updated externally or saved, keep selectedEntry in sync
        setSelectedEntry((prev) => {
          if (!prev) return null;
          const match = updatedEntries.find((e) => e.id === prev.id);
          return match || prev;
        });
      },
      (error) => {
        console.error('Failed to subscribe to user entries:', error);
        setErrorMessage('Unable to synchronize journal data from Firestore.');
        setEntriesLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err: any) {
      console.error('Sign out error:', err);
    }
  };

  const handleOpenNewEntry = () => {
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const handleOpenEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
    setSelectedEntry(null); // Close detail modal while editing
  };

  const handleSaveSuccess = (savedEntry: Partial<JournalEntry>) => {
    // If it was just edited or created, we can optionally focus it
    if (savedEntry.id) {
      const fullEntry = entries.find((e) => e.id === savedEntry.id);
      if (fullEntry) {
        setSelectedEntry(fullEntry);
      }
    }
  };

  const handleDeleteEntry = (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-stone-900 text-stone-100 flex items-center justify-center mx-auto shadow-xs">
            <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
          </div>
          <p className="text-xs font-serif text-stone-600 font-medium">Reading the Signals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 flex flex-col font-sans selection:bg-amber-100 selection:text-stone-900">
      {/* Top Navbar */}
      <Navbar
        user={user}
        onNewEntry={handleOpenNewEntry}
        onSignOut={handleSignOut}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {errorMessage && (
          <div className="mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-stone-400 hover:text-stone-700 text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {!user ? (
          <AuthView onAuthSuccess={() => {}} />
        ) : (
          <div className="space-y-6">
            {/* Dashboard Subheader */}
            <div className="border-b border-stone-200/70 pb-4 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-stone-900 tracking-tight">
                  Your Reflection Journal
                </h2>
                <p className="text-xs text-stone-500 mt-0.5">
                  Record moments, examine your reactions, and converse with your non-diagnostic AI partner.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-[11px] text-stone-500 bg-stone-100/70 px-2.5 py-1 rounded-lg border border-stone-200/50 self-start sm:self-auto">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>Isolated UID Vault</span>
              </div>
            </div>

            {/* Journal Entries Grid / List */}
            <JournalList
              entries={entries}
              loading={entriesLoading}
              onSelectEntry={(entry) => setSelectedEntry(entry)}
              onNewEntry={handleOpenNewEntry}
            />

            {/* Day 5: Cross-Entry Recurring Pattern Analysis Section */}
            {!entriesLoading && entries.length > 0 && (
              <PatternAnalysisSection
                entries={entries}
                onSelectEntry={(entry) => setSelectedEntry(entry)}
              />
            )}
          </div>
        )}
      </main>

      {/* Modals & Dialogs */}
      {editorOpen && user && (
        <JournalEditor
          userId={user.uid}
          initialEntry={editingEntry}
          onClose={() => {
            setEditorOpen(false);
            setEditingEntry(null);
          }}
          onSaveSuccess={handleSaveSuccess}
        />
      )}

      {selectedEntry && user && (
        <EntryDetailModal
          userId={user.uid}
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onEdit={handleOpenEditEntry}
          onDelete={handleDeleteEntry}
          onUpdate={(updated) => setSelectedEntry(updated)}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200/60 bg-[#FAF7F2] py-4 text-center text-[11px] text-stone-400">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Reading the Signals • Private Personal Reflection</span>
          <span>Non-diagnostic AI partner for self-inquiry</span>
        </div>
      </footer>
    </div>
  );
}

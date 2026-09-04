import React, { useState, useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, signOutUser, subscribeUserEntries } from './lib/firebase';
import { UserProfile, JournalEntry } from './types';
import { Navbar, AppView } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { JournalList } from './components/JournalList';
import { JournalEditor } from './components/JournalEditor';
import { JournalEditorPage } from './components/JournalEditorPage';
import { EntryDetailModal } from './components/EntryDetailModal';
import { EntryDetailPage } from './components/EntryDetailPage';
import { PatternAnalysisSection } from './components/PatternAnalysisSection';
import { DailyReminderSettings } from './components/DailyReminderSettings';
import { DailyReminderRuntime } from './components/DailyReminderRuntime';
import { Loader2, AlertCircle } from 'lucide-react';

type EntriesSubscriptionStatus = 'loading' | 'ready' | 'error';

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const routedEntryMatch = useMatch('/journal/:entryId');
  const routedEntryId = routedEntryMatch?.params.entryId;
  const isWriteRoute = location.pathname === '/write';
  const activeView: AppView = location.pathname === '/insights' ? 'insights' : 'journal';
  // True when the Journal archive grid, Write view, or Insights view is active — keeping the dark
  // editorial canvas unified across the core authenticated journaling workflows.
  const isJournalGridView = !isWriteRoute && !routedEntryId && activeView === 'journal';
  const isDarkCanvas = isJournalGridView || isWriteRoute || activeView === 'insights';

  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [entriesSubscriptionStatus, setEntriesSubscriptionStatus] = useState<EntriesSubscriptionStatus>('loading');
  const [entriesSyncError, setEntriesSyncError] = useState<string | null>(null);

  // Modal / View states
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [pendingNewEntryId, setPendingNewEntryId] = useState<string | null>(null);
  const journalDetailNavigationRef = useRef<string | null>(null);
  const writeNavigationRef = useRef<string | null>(null);
  const entriesSubscriptionGenerationRef = useRef(0);

  // Tracks whether this session has ever seen an authenticated user, so the
  // sign-out branch below can distinguish a genuine sign-out (reset to
  // /journal, preserving prior behavior) from an initial signed-out page
  // load (no redirect, so a direct signed-out visit to /insights still
  // renders AuthView at that URL instead of being forced to /journal).
  const hasBeenSignedInRef = useRef(false);

  // Listen to Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      entriesSubscriptionGenerationRef.current += 1;
      if (firebaseUser) {
        hasBeenSignedInRef.current = true;
        setEntries([]);
        setEntriesSubscriptionStatus('loading');
        setEntriesSyncError(null);
        setSelectedEntry(null);
        setPendingNewEntryId(null);
        setEditorOpen(false);
        setEditingEntry(null);
        journalDetailNavigationRef.current = null;
        writeNavigationRef.current = null;
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isAnonymous: firebaseUser.isAnonymous,
        });
      } else {
        const wasSignedIn = hasBeenSignedInRef.current;
        hasBeenSignedInRef.current = false;
        setUser(null);
        setEntries([]);
        setEntriesSubscriptionStatus('loading');
        setEntriesSyncError(null);
        setSelectedEntry(null);
        setPendingNewEntryId(null);
        setEditorOpen(false);
        setEditingEntry(null);
        journalDetailNavigationRef.current = null;
        writeNavigationRef.current = null;
        if (wasSignedIn) {
          navigate('/journal', { replace: true });
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  // Listen to isolated real-time Firestore entries for the authenticated user
  useEffect(() => {
    if (!user) {
      setEntries([]);
      setEntriesSubscriptionStatus('loading');
      setEntriesSyncError(null);
      return;
    }

    setEntriesSubscriptionStatus('loading');
    setEntriesSyncError(null);
    setEntries([]);
    const subscriptionGeneration = entriesSubscriptionGenerationRef.current;
    const unsubscribe = subscribeUserEntries(
      user.uid,
      (updatedEntries) => {
        if (subscriptionGeneration !== entriesSubscriptionGenerationRef.current) return;
        setEntries(updatedEntries);
        setEntriesSubscriptionStatus('ready');
        setEntriesSyncError(null);
        // If an active modal entry was updated externally or saved, keep selectedEntry in sync
        setSelectedEntry((prev) => {
          if (!prev) return null;
          const match = updatedEntries.find((e) => e.id === prev.id);
          return match || prev;
        });
      },
      (error) => {
        if (subscriptionGeneration !== entriesSubscriptionGenerationRef.current) return;
        console.error('Failed to subscribe to user entries:', error);
        setEntriesSubscriptionStatus('error');
        setEntriesSyncError('Unable to synchronize journal data.');
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
    if (isWriteRoute) return;
    if (location.pathname !== '/insights') {
      const returnTo = routedEntryId ? location.pathname : '/journal';
      writeNavigationRef.current = returnTo;
      navigate('/write', {
        state: { fromJournal: true, returnTo },
      });
      return;
    }
    setEditingEntry(null);
    setEditorOpen(true);
  };

  const handleOpenEditEntry = (entry: JournalEntry) => {
    setEditingEntry(entry);
    setEditorOpen(true);
    setSelectedEntry(null); // Close detail modal while editing
  };

  const handleSaveSuccess = (savedEntry: Partial<JournalEntry>) => {
    if (routedEntryId) return;
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

  const routedEntry = routedEntryId
    ? entries.find((entry) => entry.id === routedEntryId)
    : undefined;

  const handleRoutedBack = () => {
    if (location.state?.fromJournal === true && journalDetailNavigationRef.current === routedEntryId) {
      journalDetailNavigationRef.current = null;
      navigate(-1);
      return;
    }
    navigate('/journal');
  };

  const isAllowedWriteReturn = (value: unknown): value is string =>
    value === '/journal' || (typeof value === 'string' && /^\/journal\/[^/]+$/.test(value));

  const handleWriteCancel = () => {
    const returnTo = location.state?.returnTo;
    if (
      location.state?.fromJournal === true &&
      isAllowedWriteReturn(returnTo) &&
      writeNavigationRef.current === returnTo
    ) {
      writeNavigationRef.current = null;
      navigate(-1);
      return;
    }
    navigate('/journal');
  };

  const handlePendingCreateFailureBack = () => {
    setPendingNewEntryId(null);
    writeNavigationRef.current = null;
    navigate('/journal');
  };

  useEffect(() => {
    if (!pendingNewEntryId || location.pathname !== '/write') return;
    if (!entries.some((entry) => entry.id === pendingNewEntryId)) return;

    const entryId = pendingNewEntryId;
    setPendingNewEntryId(null);
    writeNavigationRef.current = null;
    navigate(`/journal/${encodeURIComponent(entryId)}`, { replace: true });
  }, [entries, location.pathname, navigate, pendingNewEntryId]);

  useEffect(() => {
    if (location.pathname !== '/write' && pendingNewEntryId) {
      setPendingNewEntryId(null);
    }
  }, [location.pathname, pendingNewEntryId]);

  if (authLoading) {
    return (
      <div className="bg-background px-4 py-16 text-text-primary sm:py-24">
        <div role="status" aria-live="polite" className="flex items-center justify-center gap-2.5">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-primary" aria-hidden="true" />
          <span className="text-sm text-text-secondary">Opening your journal&hellip;</span>
        </div>
      </div>
    );
  }

  // Route-level redirects only. Real /journal and /insights content below
  // is derived from the current location (activeView above); these routes
  // exist solely to send / and any unknown path to /journal without
  // rendering a duplicate view. Shared between the signed-out and
  // signed-in shells so URL normalization behaves identically either way.
  const routeRedirects = (
    <Routes>
      <Route path="/" element={<Navigate to="/journal" replace />} />
      <Route path="/journal" element={null} />
      <Route path="/journal/:entryId" element={null} />
      <Route path="/write" element={null} />
      <Route path="/insights" element={null} />
      <Route path="*" element={<Navigate to="/journal" replace />} />
    </Routes>
  );

  const skipLink = (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-text-primary focus:shadow-dialog"
    >
      Skip to main content
    </a>
  );

  // Signed-out: a dedicated, full-screen Auth shell — no Navbar, no
  // constrained/padded <main>, no Footer. AuthView owns the entire
  // viewport and its own branding; it no longer needs to fight a
  // max-width/padded parent for full-bleed layout.
  if (!user) {
    return (
      <>
        {skipLink}
        {routeRedirects}
        <main id="main-content" tabIndex={-1} className="w-full">
          <AuthView onAuthSuccess={() => {}} />
        </main>
      </>
    );
  }

  return (
    <div className={`min-h-screen ${isDarkCanvas ? 'bg-journal-bg' : 'bg-background'} text-text-primary flex flex-col font-sans`}>
      {skipLink}
      {routeRedirects}

      <DailyReminderRuntime
        userId={user.uid}
        entries={entries}
        entriesReady={entriesSubscriptionStatus === 'ready'}
        onWrite={() => navigate('/write')}
      />

      {/* Top Navbar */}
      <Navbar
        user={user}
        activeView={activeView}
        writeActive={isWriteRoute}
        onNavigate={(view) => navigate(`/${view}`)}
        onNewEntry={handleOpenNewEntry}
        onSignOut={handleSignOut}
        dark={isDarkCanvas}
      />

      {/* Main Content Area */}
      <main
        id="main-content"
        tabIndex={-1}
        className={
          isJournalGridView
            ? 'w-full flex-1'
            : isWriteRoute
              ? 'mx-auto w-full max-w-shell flex-1 px-4 pt-6 pb-28 sm:px-6 sm:pt-8 sm:pb-28 md:pt-10 md:pb-16 lg:px-8 lg:pt-12'
              : 'mx-auto w-full max-w-shell flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pb-28 sm:pt-8 md:pb-8 lg:px-8'
        }
      >
        {entriesSyncError && !(routedEntryId || (isWriteRoute && pendingNewEntryId)) && (
          <div
            role="alert"
            className={
              'mb-6 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between text-xs text-red-700' +
              (isDarkCanvas ? ' mx-4 mt-6 sm:mx-6 sm:mt-8 lg:mx-8' : '')
            }
          >
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{entriesSyncError}</span>
            </div>
            <button
              type="button"
              onClick={() => setEntriesSyncError(null)}
              aria-label="Dismiss synchronization error"
              className="text-stone-400 hover:text-stone-700 text-xs font-medium cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {isWriteRoute ? (
            pendingNewEntryId ? (
              entriesSubscriptionStatus === 'error' ? (
                <div className="rounded-feature border border-border bg-surface px-6 py-12 text-center">
                  <h2 className="font-serif text-xl font-semibold text-text-primary">Your reflection was saved, but we couldn't reopen it yet.</h2>
                  <p className="mx-auto mt-2 max-w-reading text-sm text-text-secondary">Your journal couldn't be synchronized right now.</p>
                  <button type="button" onClick={handlePendingCreateFailureBack} className="mt-5 min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle">
                    Back to Journal
                  </button>
                </div>
              ) : (
                <p role="status" className="py-12 text-center text-sm text-text-muted">Opening reflection&hellip;</p>
              )
            ) : (
              <JournalEditorPage
                userId={user.uid}
                onCancel={handleWriteCancel}
                onSaveSuccess={(savedEntry) => {
                  if (savedEntry.id) setPendingNewEntryId(savedEntry.id);
                }}
              />
            )
          ) : routedEntryId ? (
            entriesSubscriptionStatus === 'loading' ? (
              <p role="status" className="py-12 text-center text-sm text-text-muted">Opening reflection&hellip;</p>
            ) : entriesSubscriptionStatus === 'error' ? (
              <div className="rounded-feature border border-border bg-surface px-6 py-12 text-center">
                <h2 className="font-serif text-xl font-semibold text-text-primary">We couldn't sync your journal right now.</h2>
                <p className="mx-auto mt-2 max-w-reading text-sm text-text-secondary">Your journal couldn't be loaded. Please try again later.</p>
                <button type="button" onClick={() => navigate('/journal')} className="mt-5 min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle">
                  Back to Journal
                </button>
              </div>
            ) : routedEntry ? (
              <EntryDetailPage
                userId={user.uid}
                entry={routedEntry}
                onBack={handleRoutedBack}
                onEdit={handleOpenEditEntry}
                onDelete={(entryId) => {
                  handleDeleteEntry(entryId);
                  navigate('/journal', { replace: true });
                }}
                onUpdate={(updated) => {
                  setEntries((prev) => prev.map((entry) => (entry.id === updated.id ? updated : entry)));
                }}
              />
            ) : (
              <div className="rounded-feature border border-border bg-surface px-6 py-12 text-center">
                <h2 className="font-serif text-xl font-semibold text-text-primary">This reflection isn't available.</h2>
                <button type="button" onClick={() => navigate('/journal')} className="mt-5 min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-semibold text-text-primary hover:bg-surface-subtle">
                  Back to Journal
                </button>
              </div>
            )
          ) : (
          <div className={activeView === 'journal' ? '-mx-4 -my-6 sm:-mx-6 sm:-my-8 lg:-mx-8' : 'space-y-6'}>
            {activeView === 'journal' ? (
              <>
                <DailyReminderSettings userId={user.uid} />
                <JournalList
                  entries={entries}
                  loading={entriesSubscriptionStatus === 'loading'}
                  userId={user.uid}
                  onSelectEntry={(entry) => {
                    journalDetailNavigationRef.current = entry.id;
                    navigate(`/journal/${encodeURIComponent(entry.id)}`, { state: { fromJournal: true } });
                  }}
                  onNewEntry={handleOpenNewEntry}
                />
              </>
            ) : (
              <>
                <div className="border-b border-journal-border pb-4">
                  <div>
                    <h2 className="font-serif text-2xl font-bold tracking-tight text-journal-ink sm:text-3xl">Insights</h2>
                    <p className="mt-1 text-sm text-journal-ink-muted">
                      See recurring signals, changes over time, and questions worth exploring.
                    </p>
                  </div>
                </div>

                {entriesSubscriptionStatus === 'loading' ? (
                  <p role="status" className="py-12 text-center text-sm text-journal-ink-muted">Loading your reflections…</p>
                ) : entries.length > 0 ? (
                  <PatternAnalysisSection entries={entries} onSelectEntry={(entry) => setSelectedEntry(entry)} />
                ) : (
                  <div className="rounded-feature border border-journal-border bg-journal-panel/40 px-6 py-12 text-center">
                    <h3 className="font-serif text-lg font-semibold text-journal-ink">Insights begin with your reflections</h3>
                    <p className="mx-auto mt-2 max-w-reading text-sm text-journal-ink-muted">
                      Write a reflection first, then return here to explore patterns and connections.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          )
        }
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
          onUpdate={(updated) => {
            setSelectedEntry(updated);
            setEntries((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
          }}
        />
      )}

      {/* Footer — dark, continuing the archive, for the Journal grid and Write views. */}
      <footer
        className={
          (isDarkCanvas ? 'border-t border-journal-border bg-journal-bg text-journal-ink-muted' : 'border-t border-border bg-surface-subtle text-text-muted') +
          ' py-4 text-center text-xs' +
          (user ? ' mb-[calc(4rem+env(safe-area-inset-bottom))] md:mb-0' : '')
        }
      >
        <div className="mx-auto flex max-w-shell flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
          <span>Reading the Signals • Private Personal Reflection</span>
          <span>Non-diagnostic AI partner for self-inquiry</span>
        </div>
      </footer>
    </div>
  );
}

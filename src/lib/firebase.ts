import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  CandidateSignal,
  ChatMessage,
  DailyReminderSettings,
  JournalEntry,
  RememberedSignal,
  StructuredSummary,
} from '../types';
import { SAMPLE_ENTRIES } from '../data/sampleEntries';
import { isValidReminderTime, isValidTimeZone } from './reminders';

// Initialize Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore
const databaseId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId || '(default)';
export const db: Firestore = databaseId && databaseId !== '(default)'
  ? getFirestore(app, databaseId)
  : getFirestore(app);

// Authentication helpers
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signInAsGuest = async () => {
  try {
    const result = await signInAnonymously(auth);
    return result.user;
  } catch (error) {
    console.error('Error signing in as guest:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Defensive Undefined-Stripping Utility
 * Prevents Firestore runtime errors caused by undefined properties.
 */
export function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        cleaned[key] = cleanPayload(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) =>
          item !== null && typeof item === 'object' ? cleanPayload(item) : item
        );
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned as T;
}

/**
 * Subscribes to real-time entries for the authenticated user only.
 * Isolated strictly at path: /users/{userId}/entries
 */
export function subscribeUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const entriesRef = collection(db, 'users', userId, 'entries');
  const q = query(entriesRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const entries: JournalEntry[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          userId: data.userId || userId,
          title: data.title || 'Untitled Reflection',
          date: data.date || new Date().toISOString().split('T')[0],
          content: data.content || '',
          situation: data.situation || '',
          behaviorOrEvent: data.behaviorOrEvent || '',
          feelingOrReaction: data.feelingOrReaction || '',
          importantContext: data.importantContext || '',
          summary: data.summary || null,
          reflections: Array.isArray(data.reflections) ? data.reflections : [],
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now(),
        };
      });
      onUpdate(entries);
    },
    (err) => {
      console.error('Firestore subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Subscribes to remembered signals for the authenticated user, newest first.
 * Isolated strictly at path: /users/{userId}/rememberedSignals
 */
export function subscribeUserRememberedSignals(
  userId: string,
  onUpdate: (signals: RememberedSignal[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const signalsRef = collection(db, 'users', userId, 'rememberedSignals');
  const q = query(signalsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const signals: RememberedSignal[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          sourceEntryId: data.sourceEntryId || '',
          text: data.text || '',
          suggestedAction: data.suggestedAction || '',
          createdAt: data.createdAt || 0,
        };
      });
      onUpdate(signals);
    },
    (err) => {
      console.error('Remembered signals subscription error:', err);
      if (onError) onError(err);
    }
  );
}

export function normalizeCandidateSignalText(signalText: string): string {
  return signalText.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

async function createRememberedSignalId(sourceEntryId: string, signalText: string): Promise<string> {
  const normalizedText = normalizeCandidateSignalText(signalText);
  const identity = `${sourceEntryId.length}:${sourceEntryId}|${normalizedText}`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `signal_${hash}`;
}

/**
 * Remembers one candidate signal. The deterministic document ID makes repeated
 * writes for the same source entry and normalized candidate text idempotent.
 */
export async function rememberSignal(
  userId: string,
  sourceEntryId: string,
  signal: CandidateSignal
): Promise<string> {
  if (!userId || !sourceEntryId) throw new Error('Missing userId or sourceEntryId for remembered signal.');

  const text = signal.text.trim();
  const suggestedAction = signal.suggestedAction.trim();
  if (!text || !suggestedAction) throw new Error('Remembered signal text and suggested action are required.');

  const signalId = await createRememberedSignalId(sourceEntryId, text);
  const signalRef = doc(db, 'users', userId, 'rememberedSignals', signalId);
  const payload = cleanPayload({
    sourceEntryId,
    text,
    suggestedAction,
    createdAt: Date.now(),
  });

  await setDoc(signalRef, payload);
  return signalId;
}

/**
 * Forgets exactly one remembered signal owned by the authenticated user path.
 */
export async function forgetSignal(userId: string, signalId: string): Promise<void> {
  if (!userId || !signalId) throw new Error('Missing userId or signalId for remembered signal deletion.');

  const signalRef = doc(db, 'users', userId, 'rememberedSignals', signalId);
  await deleteDoc(signalRef);
}

/**
 * Subscribes to the authenticated user's single daily reminder setting.
 * Isolated strictly at path: /users/{userId}/settings/dailyReminder
 */
export function subscribeDailyReminderSettings(
  userId: string,
  onUpdate: (settings: DailyReminderSettings | null) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate(null);
    return () => {};
  }

  const settingsRef = doc(db, 'users', userId, 'settings', 'dailyReminder');
  return onSnapshot(
    settingsRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }

      const data = snapshot.data();
      if (
        typeof data.enabled !== 'boolean' ||
        typeof data.time !== 'string' ||
        typeof data.timeZone !== 'string' ||
        !isValidReminderTime(data.time) ||
        !isValidTimeZone(data.timeZone)
      ) {
        console.warn('Ignored malformed daily reminder settings.');
        onUpdate(null);
        return;
      }

      onUpdate({
        enabled: data.enabled,
        time: data.time,
        timeZone: data.timeZone,
      });
    },
    (err) => {
      console.error('Daily reminder settings subscription error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Saves the authenticated user's single daily reminder setting.
 */
export async function saveDailyReminderSettings(
  userId: string,
  settings: DailyReminderSettings
): Promise<void> {
  if (!userId) throw new Error('Missing userId for daily reminder settings.');
  if (typeof settings.enabled !== 'boolean') throw new Error('Daily reminder enabled state must be a boolean.');
  if (!isValidReminderTime(settings.time)) throw new Error('Daily reminder time must use 24-hour HH:mm format.');
  if (!isValidTimeZone(settings.timeZone)) throw new Error('Daily reminder timezone must be a valid IANA timezone.');

  const settingsRef = doc(db, 'users', userId, 'settings', 'dailyReminder');
  await setDoc(settingsRef, cleanPayload(settings));
}

/**
 * Creates a new journal entry under the user's isolated Firestore subcollection.
 */
export async function createJournalEntry(
  userId: string,
  entryData: Omit<JournalEntry, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'reflections'> & {
    reflections?: ChatMessage[];
  }
): Promise<string> {
  if (!userId) throw new Error('User must be authenticated to create a journal entry.');

  const entriesRef = collection(db, 'users', userId, 'entries');
  const newEntryDoc = doc(entriesRef);
  const now = Date.now();

  const rawPayload = {
    userId,
    title: entryData.title.trim() || 'Untitled Reflection',
    date: entryData.date || new Date().toISOString().split('T')[0],
    content: entryData.content || '',
    situation: entryData.situation || '',
    behaviorOrEvent: entryData.behaviorOrEvent || '',
    feelingOrReaction: entryData.feelingOrReaction || '',
    importantContext: entryData.importantContext || '',
    summary: entryData.summary || null,
    reflections: entryData.reflections || [],
    createdAt: now,
    updatedAt: now,
    _serverTimestamp: serverTimestamp(),
  };

  const payload = cleanPayload(rawPayload);
  await setDoc(newEntryDoc, payload);
  return newEntryDoc.id;
}

/**
 * Updates an existing journal entry.
 */
export async function updateJournalEntry(
  userId: string,
  entryId: string,
  updates: Partial<Omit<JournalEntry, 'id' | 'userId' | 'createdAt'>>
): Promise<void> {
  if (!userId || !entryId) throw new Error('Missing userId or entryId for update.');

  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  const rawPayload = {
    ...updates,
    updatedAt: Date.now(),
    _serverTimestamp: serverTimestamp(),
  };

  const payload = cleanPayload(rawPayload);
  await updateDoc(entryRef, payload);
}

/**
 * Appends a multi-turn reflection chat message to an entry.
 */
export async function appendReflectionMessage(
  userId: string,
  entryId: string,
  currentReflections: ChatMessage[],
  newMessage: ChatMessage
): Promise<void> {
  if (!userId || !entryId) throw new Error('Missing userId or entryId for message append.');

  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  const updatedReflections = [...currentReflections, newMessage];

  const payload = cleanPayload({
    reflections: updatedReflections,
    updatedAt: Date.now(),
  });

  await updateDoc(entryRef, payload);
}

/**
 * Deletes a journal entry.
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('Missing userId or entryId for delete.');

  const entryRef = doc(db, 'users', userId, 'entries', entryId);
  await deleteDoc(entryRef);
}

/**
 * Imports the 9 canonical sample entries into the authenticated user's normal Firestore subcollection.
 * Safe, idempotent, and partial-import resilient:
 * Uses deterministic document IDs (sample_import_${sample.id}).
 * Checks existence first and never overwrites existing entries.
 */
export async function importSampleEntries(
  userId: string
): Promise<{ added: number; existing: number }> {
  if (!userId) throw new Error('User must be authenticated to import sample reflections.');

  let added = 0;
  let existing = 0;

  for (const sample of SAMPLE_ENTRIES) {
    const docId = `sample_import_${sample.id}`;
    const docRef = doc(db, 'users', userId, 'entries', docId);

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      existing++;
      continue;
    }

    const rawPayload = {
      userId,
      title: sample.title || 'Untitled Reflection',
      date: sample.date || new Date().toISOString().split('T')[0],
      content: sample.content || '',
      situation: sample.situation || '',
      behaviorOrEvent: sample.behaviorOrEvent || '',
      feelingOrReaction: sample.feelingOrReaction || '',
      importantContext: sample.importantContext || '',
      summary: sample.summary || null,
      reflections: Array.isArray(sample.reflections) ? sample.reflections : [],
      createdAt: sample.createdAt || Date.now(),
      updatedAt: sample.updatedAt || Date.now(),
      _serverTimestamp: serverTimestamp(),
    };

    const payload = cleanPayload(rawPayload);
    await setDoc(docRef, payload);
    added++;
  }

  return { added, existing };
}


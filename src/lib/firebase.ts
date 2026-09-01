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
import { JournalEntry, StructuredSummary, ChatMessage } from '../types';
import { SAMPLE_ENTRIES } from '../data/sampleEntries';

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


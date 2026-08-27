export interface StructuredSummary {
  situation: string;
  behaviorOrEvent: string;
  feelingOrReaction: string;
  importantContext: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  date: string; // ISO date string (YYYY-MM-DD)
  content: string; // Main reflection text
  situation?: string;
  behaviorOrEvent?: string;
  feelingOrReaction?: string;
  importantContext?: string;
  summary: StructuredSummary | null;
  reflections: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

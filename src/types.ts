export interface StructuredSummary {
  situation: string;
  behaviorOrEvent: string;
  feelingOrReaction: string;
  importantContext: string;
  subjects?: string[];
  theme?: string;
  emotionalTone?: string;
  interpretation?: string;
}

export interface PatternSupportingEntry {
  entryId: string;
  title: string;
  date: string;
}

export type EvidenceStrength = 'thin' | 'emerging' | 'strong';

export interface CrossEntryPattern {
  observation: string;
  evidenceCount: number;
  evidenceStrength?: EvidenceStrength;
  supportingEntries: PatternSupportingEntry[];
  explanation: string;
}

export interface CrossEntryAnalysisResult {
  hasSufficientEvidence: boolean;
  message?: string;
  patterns: CrossEntryPattern[];
}

export interface CrossEntryContradiction {
  observation: string;
  evidenceCount: number;
  supportingEntries: PatternSupportingEntry[];
  explanation: string;
  clarifyingQuestion: string;
}

export interface CrossEntryContradictionResult {
  hasSufficientEvidence: boolean;
  message?: string;
  contradictions: CrossEntryContradiction[];
}

export type TimelineShiftType =
  | 'perspective'
  | 'emotional_reaction'
  | 'interpretation'
  | 'focus';

export interface TimelineSupportingEntry {
  entryId: string;
  title: string;
  date: string;
  roleInShift?: 'earlier_state' | 'later_state' | 'context' | string;
}

export interface SignalTimelineShift {
  shiftType: TimelineShiftType;
  earlierState: string;
  laterState: string;
  observation: string;
  explanation: string;
  evidenceCount: number;
  supportingEntries: TimelineSupportingEntry[];
  earlierDate?: string;
  laterDate?: string;
}

export interface SignalTimelineResult {
  hasSufficientEvidence: boolean;
  message?: string;
  shifts: SignalTimelineShift[];
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

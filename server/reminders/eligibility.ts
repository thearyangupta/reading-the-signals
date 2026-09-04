import type { Firestore } from 'firebase-admin/firestore';
import {
  getLocalDayUtcRange,
  hasReminderTimeOccurredForLocalDay,
  isValidReminderTime,
  isValidTimeZone,
} from '../../src/lib/reminders.ts';
export type ReminderEligibilityReason =
  | 'missing-settings'
  | 'disabled'
  | 'invalid-time'
  | 'invalid-time-zone'
  | 'invalid-now'
  | 'before-reminder-time'
  | 'journaled-today'
  | 'eligible';

export interface ReminderEligibilityContext {
  valid: boolean;
  due: boolean;
  reason: ReminderEligibilityReason;
  localDate?: string;
  dayStartUtcMs?: number;
  nextDayStartUtcMs?: number;
}

export interface DailyReminderEligibility extends ReminderEligibilityContext {
  eligible: boolean;
  journaledToday: boolean | null;
}

type JournalEntryLookup = (uid: string, startUtcMs: number, endUtcMs: number) => Promise<boolean>;

export interface ReminderSettingsInput {
  enabled?: unknown;
  time?: unknown;
  timeZone?: unknown;
}

export function getReminderEligibilityContext(
  settings: ReminderSettingsInput | null | undefined,
  now: Date
): ReminderEligibilityContext {
  if (!settings) return { valid: false, due: false, reason: 'missing-settings' };
  if (typeof settings.time !== 'string' || !isValidReminderTime(settings.time)) {
    return { valid: false, due: false, reason: 'invalid-time' };
  }
  if (typeof settings.timeZone !== 'string' || !isValidTimeZone(settings.timeZone)) {
    return { valid: false, due: false, reason: 'invalid-time-zone' };
  }
  if (!Number.isFinite(now.getTime())) {
    return { valid: false, due: false, reason: 'invalid-now' };
  }
  if (settings.enabled !== true) return { valid: true, due: false, reason: 'disabled' };

  const range = getLocalDayUtcRange(now, settings.timeZone);
  if (!range) return { valid: false, due: false, reason: 'invalid-now' };

  const due = hasReminderTimeOccurredForLocalDay(now, settings.time, settings.timeZone);
  return {
    valid: true,
    due,
    reason: due ? 'eligible' : 'before-reminder-time',
    localDate: range.localDate,
    dayStartUtcMs: range.startUtcMs,
    nextDayStartUtcMs: range.nextStartUtcMs,
  };
}

export async function evaluateDailyReminderEligibility(input: {
  uid: string;
  settings: ReminderSettingsInput | null | undefined;
  now: Date;
  hasJournalEntry: JournalEntryLookup;
}): Promise<DailyReminderEligibility> {
  const context = getReminderEligibilityContext(input.settings, input.now);
  if (
    !context.due ||
    context.dayStartUtcMs === undefined ||
    context.nextDayStartUtcMs === undefined
  ) {
    return { ...context, eligible: false, journaledToday: null };
  }

  const journaledToday = await input.hasJournalEntry(
    input.uid,
    context.dayStartUtcMs,
    context.nextDayStartUtcMs
  );
  return {
    ...context,
    eligible: !journaledToday,
    journaledToday,
    reason: journaledToday ? 'journaled-today' : 'eligible',
  };
}

export function createJournalEntryExistenceStore(db: Firestore) {
  return {
    async hasJournalEntryForUtcRange(
      uid: string,
      startUtcMs: number,
      endUtcMs: number
    ): Promise<boolean> {
      if (!uid.trim() || uid.includes('/')) throw new Error('A valid journal owner uid is required.');
      if (!Number.isFinite(startUtcMs) || !Number.isFinite(endUtcMs) || endUtcMs <= startUtcMs) {
        throw new Error('A valid journal entry UTC range is required.');
      }

      const snapshot = await db
        .collection(`users/${uid}/entries`)
        .where('createdAt', '>=', startUtcMs)
        .where('createdAt', '<', endUtcMs)
        .limit(1)
        .select()
        .get();
      return !snapshot.empty;
    },
  };
}

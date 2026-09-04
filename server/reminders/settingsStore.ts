import type { Firestore } from 'firebase-admin/firestore';
import type { ReminderSettingsInput } from './eligibility.ts';

export interface ReminderSettingsCandidate {
  uid: string;
  settings: ReminderSettingsInput;
}

export interface ReminderSettingsSource {
  listEnabledReminderSettings(limit: number): Promise<ReminderSettingsCandidate[]>;
}

const MAX_REMINDER_SETTINGS_BATCH_SIZE = 100;

export function extractUidFromDailyReminderPath(path: string): string | null {
  const segments = path.split('/');
  if (
    segments.length !== 4 ||
    segments[0] !== 'users' ||
    !segments[1] ||
    segments[2] !== 'settings' ||
    segments[3] !== 'dailyReminder'
  ) {
    return null;
  }
  return segments[1];
}

export function createReminderSettingsSource(db: Firestore): ReminderSettingsSource {
  return {
    async listEnabledReminderSettings(limit: number): Promise<ReminderSettingsCandidate[]> {
      const boundedLimit = Math.min(
        Math.max(Number.isInteger(limit) ? limit : 1, 1),
        MAX_REMINDER_SETTINGS_BATCH_SIZE
      );
      const snapshot = await db
        .collectionGroup('settings')
        .where('enabled', '==', true)
        .limit(boundedLimit)
        .select('enabled', 'time', 'timeZone')
        .get();

      const candidates: ReminderSettingsCandidate[] = [];
      for (const document of snapshot.docs) {
        const uid = extractUidFromDailyReminderPath(document.ref.path);
        if (!uid) continue;
        const data = document.data();
        candidates.push({
          uid,
          settings: { enabled: data.enabled, time: data.time, timeZone: data.timeZone },
        });
      }
      return candidates;
    },
  };
}

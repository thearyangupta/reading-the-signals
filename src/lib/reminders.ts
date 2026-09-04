import { JournalEntry } from '../types';

const REMINDER_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_NEXT_REMINDER_SEARCH_MINUTES = 72 * 60;

export function isValidReminderTime(time: string): boolean {
  return REMINDER_TIME_PATTERN.test(time);
}

export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone.trim()) return false;

  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

export function getCurrentTimeZone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === 'string' && isValidTimeZone(timeZone) ? timeZone : null;
  } catch {
    return null;
  }
}

function createZonedFormatter(timeZone: string, includeTime: boolean): Intl.DateTimeFormat | null {
  if (!isValidTimeZone(timeZone)) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  });
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string | null {
  return parts.find((part) => part.type === type)?.value ?? null;
}

function getZonedDayKey(date: Date, formatter: Intl.DateTimeFormat): string | null {
  if (!Number.isFinite(date.getTime())) return null;

  const parts = formatter.formatToParts(date);
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  return year && month && day ? `${year}-${month}-${day}` : null;
}

export function getLocalDayKey(date: Date, timeZone: string): string | null {
  const formatter = createZonedFormatter(timeZone, false);
  return formatter ? getZonedDayKey(date, formatter) : null;
}

export function hasReminderTimeOccurredForLocalDay(
  now: Date,
  time: string,
  timeZone: string
): boolean {
  if (!Number.isFinite(now.getTime()) || !isValidReminderTime(time)) return false;

  const formatter = createZonedFormatter(timeZone, true);
  if (!formatter) return false;

  const currentDay = getZonedDayKey(now, formatter);
  if (!currentDay) return false;

  const [targetHour, targetMinute] = time.split(':');
  const latestMinute = Math.floor(now.getTime() / 60_000) * 60_000;

  // Looking backward handles repeated local clock times during a DST fall-back:
  // a reminder that occurred in the first repeated hour remains due in the second.
  for (let offset = 0; offset <= 30 * 60; offset += 1) {
    const candidate = new Date(latestMinute - offset * 60_000);
    if (getZonedDayKey(candidate, formatter) !== currentDay) continue;
    const parts = formatter.formatToParts(candidate);
    if (getPart(parts, 'hour') === targetHour && getPart(parts, 'minute') === targetMinute) {
      return true;
    }
  }

  // A spring-forward may skip the configured wall-clock minute entirely. Once
  // the local clock is later than that minute, treat the reminder as overdue.
  const nowParts = formatter.formatToParts(now);
  const currentHour = getPart(nowParts, 'hour');
  const currentMinute = getPart(nowParts, 'minute');
  return currentHour !== null && currentMinute !== null && `${currentHour}:${currentMinute}` >= time;
}

export function hasJournalEntryForLocalDay(
  entries: JournalEntry[],
  now: Date,
  timeZone: string
): boolean {
  const formatter = createZonedFormatter(timeZone, false);
  if (!formatter) return false;

  const targetDay = getZonedDayKey(now, formatter);
  if (!targetDay) return false;

  return entries.some((entry) => {
    if (!Number.isFinite(entry.createdAt)) return false;
    return getZonedDayKey(new Date(entry.createdAt), formatter) === targetDay;
  });
}

export function getNextReminderAt(now: Date, time: string, timeZone: string): Date | null {
  if (!Number.isFinite(now.getTime()) || !isValidReminderTime(time)) return null;

  const formatter = createZonedFormatter(timeZone, true);
  if (!formatter) return null;

  const [targetHour, targetMinute] = time.split(':');
  const firstFutureMinute = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;

  for (let offset = 0; offset < MAX_NEXT_REMINDER_SEARCH_MINUTES; offset += 1) {
    const candidate = new Date(firstFutureMinute + offset * 60_000);
    const parts = formatter.formatToParts(candidate);
    if (getPart(parts, 'hour') === targetHour && getPart(parts, 'minute') === targetMinute) {
      return candidate;
    }
  }

  return null;
}

export function isNotificationSupported(): boolean {
  return typeof globalThis !== 'undefined' && 'Notification' in globalThis;
}

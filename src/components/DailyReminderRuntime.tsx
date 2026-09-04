import React, { useEffect, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { subscribeDailyReminderSettings } from '../lib/firebase';
import {
  getLocalDayKey,
  getNextReminderAt,
  hasJournalEntryForLocalDay,
  hasReminderTimeOccurredForLocalDay,
  isValidReminderTime,
  isValidTimeZone,
} from '../lib/reminders';
import { DailyReminderSettings, JournalEntry } from '../types';

interface DailyReminderRuntimeProps {
  userId: string;
  entries: JournalEntry[];
  entriesReady: boolean;
  onWrite: () => void;
}

export const DailyReminderRuntime: React.FC<DailyReminderRuntimeProps> = ({
  userId,
  entries,
  entriesReady,
  onWrite,
}) => {
  const [settings, setSettings] = useState<DailyReminderSettings | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const entriesRef = useRef(entries);
  const shownSessionDaysRef = useRef(new Set<string>());

  entriesRef.current = entries;

  useEffect(() => {
    setSettings(null);
    setReminderOpen(false);
    return subscribeDailyReminderSettings(userId, setSettings, () => setSettings(null));
  }, [userId]);

  useEffect(() => {
    if (
      !entriesReady ||
      !settings?.enabled ||
      !isValidReminderTime(settings.time) ||
      !isValidTimeZone(settings.timeZone)
    ) {
      setReminderOpen(false);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const scheduleFrom = (now: Date) => {
      if (!active) return;
      if (timeoutId !== null) clearTimeout(timeoutId);

      const nextReminder = getNextReminderAt(now, settings.time, settings.timeZone);
      if (!nextReminder) return;

      timeoutId = setTimeout(() => {
        timeoutId = null;
        checkNow(new Date());
      }, Math.max(0, nextReminder.getTime() - now.getTime()));
    };

    const checkNow = (now: Date) => {
      if (!active) return;

      const localDay = getLocalDayKey(now, settings.timeZone);
      const isDue = hasReminderTimeOccurredForLocalDay(now, settings.time, settings.timeZone);
      const hasEntryToday = hasJournalEntryForLocalDay(entriesRef.current, now, settings.timeZone);
      const sessionDayKey = localDay ? `${userId}:${localDay}` : null;

      if (
        sessionDayKey &&
        isDue &&
        !hasEntryToday &&
        !shownSessionDaysRef.current.has(sessionDayKey)
      ) {
        shownSessionDaysRef.current.add(sessionDayKey);
        setReminderOpen(true);
      }

      scheduleFrom(now);
    };

    const handleAppActive = () => {
      if (document.visibilityState === 'visible') checkNow(new Date());
    };

    checkNow(new Date());
    document.addEventListener('visibilitychange', handleAppActive);
    window.addEventListener('focus', handleAppActive);

    return () => {
      active = false;
      if (timeoutId !== null) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleAppActive);
      window.removeEventListener('focus', handleAppActive);
    };
  }, [entriesReady, settings, userId]);

  if (!reminderOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-reminder-title"
        aria-describedby="daily-reminder-description"
        className="relative w-full max-w-sm rounded-feature border border-journal-border bg-journal-panel p-6 shadow-dialog"
      >
        <button
          type="button"
          onClick={() => setReminderOpen(false)}
          aria-label="Dismiss daily reminder"
          className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-control text-journal-ink-faint hover:bg-journal-panel-2 hover:text-journal-ink"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-journal-panel-2 text-journal-accent-bright">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 id="daily-reminder-title" className="pr-8 font-serif text-xl font-semibold text-journal-ink">
          A signal is missing today.
        </h2>
        <p id="daily-reminder-description" className="mt-2 text-sm leading-relaxed text-journal-ink-muted">
          Take a moment to reflect on your day.
        </p>
        <button
          type="button"
          onClick={() => {
            setReminderOpen(false);
            onWrite();
          }}
          className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-control bg-accent-primary px-4 text-sm font-semibold text-white hover:bg-accent-primary-hover"
        >
          Write a reflection
        </button>
      </section>
    </div>
  );
};

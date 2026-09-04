import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, CheckCircle2, Loader2 } from 'lucide-react';
import {
  saveDailyReminderSettings,
  subscribeDailyReminderSettings,
} from '../lib/firebase';
import {
  getCurrentTimeZone,
  isNotificationSupported,
  isValidReminderTime,
} from '../lib/reminders';

interface DailyReminderSettingsProps {
  userId: string;
}

type PermissionState = NotificationPermission | 'unsupported';

const DEFAULT_REMINDER_TIME = '21:00';

export const DailyReminderSettings: React.FC<DailyReminderSettingsProps> = ({ userId }) => {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState(DEFAULT_REMINDER_TIME);
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unsupported');
  const subscriptionGenerationRef = useRef(0);

  useEffect(() => {
    const generation = ++subscriptionGenerationRef.current;
    const browserTimeZone = getCurrentTimeZone();

    setEnabled(false);
    setTime(DEFAULT_REMINDER_TIME);
    setTimeZone(browserTimeZone);
    setLoading(true);
    setSaving(false);
    setFeedback(null);
    setError(null);
    setPermission(isNotificationSupported() ? Notification.permission : 'unsupported');

    const unsubscribe = subscribeDailyReminderSettings(
      userId,
      (settings) => {
        if (generation !== subscriptionGenerationRef.current) return;
        if (settings) {
          setEnabled(settings.enabled);
          setTime(settings.time);
          setTimeZone(settings.timeZone);
        }
        setLoading(false);
      },
      () => {
        if (generation !== subscriptionGenerationRef.current) return;
        setLoading(false);
        setError("Couldn't load reminder settings. Please try again.");
      }
    );

    return () => {
      subscriptionGenerationRef.current += 1;
      unsubscribe();
    };
  }, [userId]);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    if (!isValidReminderTime(time)) {
      setError('Choose a valid time in HH:mm format.');
      return;
    }

    if (!timeZone) {
      setError("We couldn't detect your timezone. Reminder settings can't be saved yet.");
      return;
    }

    setSaving(true);
    try {
      await saveDailyReminderSettings(userId, { enabled, time, timeZone });
      setFeedback(enabled ? 'Daily reminder saved.' : 'Daily reminder disabled.');
    } catch (saveError) {
      console.error('Failed to save daily reminder settings:', saveError);
      setError("Couldn't save reminder settings. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationPermission = async () => {
    setFeedback(null);
    setError(null);

    if (!isNotificationSupported()) {
      setPermission('unsupported');
      return;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setFeedback('Browser notifications enabled.');
      } else if (result === 'denied') {
        setError('Browser notifications are blocked. In-app reminders can still work.');
      }
    } catch (permissionError) {
      console.error('Notification permission request failed:', permissionError);
      setError("Couldn't update browser notification permission.");
    }
  };

  return (
    <div className="bg-journal-atmo px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <details className="mx-auto max-w-6xl rounded-control border border-journal-border bg-journal-panel">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold text-journal-ink [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            {enabled ? <Bell className="h-4 w-4 text-journal-accent-bright" aria-hidden="true" /> : <BellOff className="h-4 w-4 text-journal-ink-muted" aria-hidden="true" />}
            Daily journal reminder
          </span>
          <span className="text-xs font-medium text-journal-ink-muted">
            {loading ? 'Loading…' : enabled ? time : 'Off'}
          </span>
        </summary>

        <form onSubmit={handleSave} className="border-t border-journal-border px-4 py-4">
          <p className="text-xs leading-relaxed text-journal-ink-muted">
            Daily reminders work while Reading the Signals is open.
          </p>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex items-center gap-2 text-sm font-medium text-journal-ink">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(event) => {
                  setEnabled(event.target.checked);
                  setFeedback(null);
                }}
                disabled={loading || saving}
                className="h-4 w-4 accent-accent-primary"
              />
              Enable daily reminder
            </label>

            <label className="text-xs font-semibold uppercase tracking-wide text-journal-ink-muted">
              Time
              <input
                type="time"
                value={time}
                onChange={(event) => {
                  setTime(event.target.value);
                  setFeedback(null);
                }}
                disabled={loading || saving}
                className="mt-1 block min-h-11 rounded-control border border-journal-border bg-journal-bg px-3 text-sm font-medium text-journal-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-journal-accent-bright"
              />
            </label>

            <button
              type="submit"
              disabled={loading || saving || !timeZone}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Save
            </button>
          </div>

          <p className="mt-3 text-xs text-journal-ink-muted">
            Timezone: {timeZone ?? 'Unavailable'}
          </p>

          {permission === 'default' && (
            <button
              type="button"
              onClick={handleNotificationPermission}
              className="mt-3 min-h-11 rounded-control border border-journal-border px-3 text-sm font-medium text-journal-ink-muted transition-colors hover:bg-journal-bg hover:text-journal-ink"
            >
              Enable browser notifications
            </button>
          )}
          {permission === 'granted' && (
            <p className="mt-3 flex items-center gap-1.5 text-xs text-positive">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Browser notifications allowed
            </p>
          )}
          {permission === 'denied' && (
            <p className="mt-3 text-xs text-journal-ink-muted">
              Browser notifications are blocked. In-app reminders remain available.
            </p>
          )}
          {permission === 'unsupported' && (
            <p className="mt-3 text-xs text-journal-ink-muted">
              Browser notifications are unavailable here. In-app reminders remain available.
            </p>
          )}

          {feedback && <p role="status" className="mt-3 text-xs font-medium text-positive">{feedback}</p>}
          {error && <p role="alert" className="mt-3 text-xs font-medium text-red-600">{error}</p>}
        </form>
      </details>
    </div>
  );
};

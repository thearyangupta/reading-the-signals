import assert from 'node:assert/strict';
import test from 'node:test';
import { getLocalDayUtcRange } from '../../src/lib/reminders.ts';
import {
  evaluateDailyReminderEligibility,
  getReminderEligibilityContext,
} from './eligibility.ts';
import type { DailyReminderSettings } from '../../src/types.ts';

const enabledSettings = (time: string, timeZone: string): DailyReminderSettings => ({
  enabled: true,
  time,
  timeZone,
});

test('rejects disabled or malformed settings', () => {
  assert.equal(getReminderEligibilityContext(null, new Date()).reason, 'missing-settings');
  assert.equal(
    getReminderEligibilityContext({ enabled: false, time: '21:00', timeZone: 'UTC' }, new Date()).reason,
    'disabled'
  );
  assert.equal(getReminderEligibilityContext(enabledSettings('25:00', 'UTC'), new Date()).reason, 'invalid-time');
  assert.equal(
    getReminderEligibilityContext(enabledSettings('21:00', 'Not/A_Time_Zone'), new Date()).reason,
    'invalid-time-zone'
  );
});

test('uses due-or-overdue reminder semantics', () => {
  const settings = enabledSettings('21:00', 'UTC');
  assert.equal(getReminderEligibilityContext(settings, new Date('2026-09-04T20:59:00Z')).due, false);
  assert.equal(getReminderEligibilityContext(settings, new Date('2026-09-04T21:00:00Z')).due, true);
  assert.equal(getReminderEligibilityContext(settings, new Date('2026-09-04T21:03:00Z')).due, true);
});

test('calculates Asia/Kolkata and UTC day boundaries', () => {
  assert.deepEqual(getLocalDayUtcRange(new Date('2026-09-04T12:00:00Z'), 'Asia/Kolkata'), {
    localDate: '2026-09-04',
    startUtcMs: Date.parse('2026-09-03T18:30:00.000Z'),
    nextStartUtcMs: Date.parse('2026-09-04T18:30:00.000Z'),
  });
  assert.deepEqual(getLocalDayUtcRange(new Date('2026-09-04T12:00:00Z'), 'UTC'), {
    localDate: '2026-09-04',
    startUtcMs: Date.parse('2026-09-04T00:00:00.000Z'),
    nextStartUtcMs: Date.parse('2026-09-05T00:00:00.000Z'),
  });
});

test('handles local midnight, month boundary, and year boundary', () => {
  assert.equal(
    getReminderEligibilityContext(enabledSettings('00:00', 'Asia/Kolkata'), new Date('2026-09-03T18:30:00Z')).localDate,
    '2026-09-04'
  );
  assert.equal(getLocalDayUtcRange(new Date('2026-02-28T23:59:59Z'), 'UTC')?.nextStartUtcMs, Date.parse('2026-03-01T00:00:00Z'));
  assert.equal(getLocalDayUtcRange(new Date('2026-12-31T23:59:59Z'), 'UTC')?.nextStartUtcMs, Date.parse('2027-01-01T00:00:00Z'));
});

test('handles DST spring-forward skipped time and 23-hour day', () => {
  const range = getLocalDayUtcRange(new Date('2026-03-08T12:00:00Z'), 'America/New_York');
  assert.deepEqual(range, {
    localDate: '2026-03-08',
    startUtcMs: Date.parse('2026-03-08T05:00:00Z'),
    nextStartUtcMs: Date.parse('2026-03-09T04:00:00Z'),
  });
  assert.equal(
    getReminderEligibilityContext(
      enabledSettings('02:30', 'America/New_York'),
      new Date('2026-03-08T07:01:00Z')
    ).due,
    true
  );
});

test('handles DST fall-back repeated time and 25-hour day', () => {
  const range = getLocalDayUtcRange(new Date('2026-11-01T12:00:00Z'), 'America/New_York');
  assert.deepEqual(range, {
    localDate: '2026-11-01',
    startUtcMs: Date.parse('2026-11-01T04:00:00Z'),
    nextStartUtcMs: Date.parse('2026-11-02T05:00:00Z'),
  });
  assert.equal(
    getReminderEligibilityContext(
      enabledSettings('01:30', 'America/New_York'),
      new Date('2026-11-01T06:15:00Z')
    ).due,
    true
  );
});

test('uses the half-open createdAt range to determine journaled today', async () => {
  const now = new Date('2026-09-04T21:03:00Z');
  const settings = enabledSettings('21:00', 'UTC');
  const evaluateWithEntries = (createdAtValues: number[]) =>
    evaluateDailyReminderEligibility({
      uid: 'user-1',
      settings,
      now,
      hasJournalEntry: async (_uid, startUtcMs, endUtcMs) =>
        createdAtValues.some((createdAt) => createdAt >= startUtcMs && createdAt < endUtcMs),
    });

  assert.equal((await evaluateWithEntries([Date.parse('2026-09-04T12:00:00Z')])).journaledToday, true);
  assert.equal((await evaluateWithEntries([Date.parse('2026-09-03T23:59:59.999Z')])).journaledToday, false);
  assert.equal((await evaluateWithEntries([Date.parse('2026-09-04T00:00:00Z')])).journaledToday, true);
  assert.equal((await evaluateWithEntries([Date.parse('2026-09-05T00:00:00Z')])).journaledToday, false);
  assert.equal((await evaluateWithEntries([])).journaledToday, false);
  assert.equal((await evaluateWithEntries([])).eligible, true);
});

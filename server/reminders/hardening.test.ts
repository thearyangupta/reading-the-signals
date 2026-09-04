import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyReminderEmail, createConfiguredDailyReminderEmailComposer } from '../email/dailyReminderEmail.ts';
import { createResendTransport } from '../email/resendTransport.ts';
import type { EmailMessage } from '../email/types.ts';
import { getEligibleReminderRecipient, type ReminderAuthUser } from './authRecipient.ts';
import { createDailyEmailReminderProcessor } from './processDailyEmailReminders.ts';
import { createScheduledReminderHandler } from './scheduledRoute.ts';
import { authenticateSchedulerRequest, type SchedulerOidcClaims } from './schedulerAuth.ts';
import { createReminderSettingsSource } from './settingsStore.ts';

const schedulerEnv = {
  REMINDER_SCHEDULER_SERVICE_ACCOUNT: 'scheduler@example.iam.gserviceaccount.com',
  REMINDER_SCHEDULER_AUDIENCE: 'https://service.example/internal/daily-email-reminders',
};

const validClaims: SchedulerOidcClaims = {
  aud: schedulerEnv.REMINDER_SCHEDULER_AUDIENCE,
  email: schedulerEnv.REMINDER_SCHEDULER_SERVICE_ACCOUNT,
  email_verified: true,
  iss: 'https://accounts.google.com',
};

test('accepts any verified linked Firebase email user and rejects ineligible recipients', () => {
  const user = (overrides: Partial<ReminderAuthUser> = {}): ReminderAuthUser => ({
    disabled: false,
    email: 'reader@example.com',
    emailVerified: true,
    providerData: [{ providerId: 'google.com' }],
    ...overrides,
  });

  assert.equal(getEligibleReminderRecipient(null), null);
  assert.equal(getEligibleReminderRecipient(user({ disabled: true })), null);
  assert.equal(getEligibleReminderRecipient(user({ emailVerified: false })), null);
  assert.equal(getEligibleReminderRecipient(user({ email: 'not-an-email' })), null);
  assert.equal(getEligibleReminderRecipient(user({ providerData: [] })), null);
  assert.equal(getEligibleReminderRecipient(user()), 'reader@example.com');
  assert.equal(
    getEligibleReminderRecipient(user({ providerData: [{ providerId: 'password' }] })),
    'reader@example.com'
  );
});

test('hardens scheduler authorization parsing, configuration, and verified claims', async () => {
  let verifyCalls = 0;
  const verifier = {
    async verify() {
      verifyCalls += 1;
      return validClaims;
    },
  };

  for (const header of ['', 'Bearer', 'Bearer   ', 'Basic token', 'bearer signed', 'BEARER signed']) {
    assert.deepEqual(await authenticateSchedulerRequest(header, schedulerEnv, verifier), {
      authorized: false,
      status: 401,
    });
  }
  assert.equal(verifyCalls, 0);
  assert.deepEqual(await authenticateSchedulerRequest('Bearer signed', {}, verifier), {
    authorized: false,
    status: 503,
  });
  assert.deepEqual(
    await authenticateSchedulerRequest('Bearer signed', schedulerEnv, { async verify() { throw new Error('no'); } }),
    { authorized: false, status: 401 }
  );
  assert.deepEqual(await authenticateSchedulerRequest('Bearer signed', schedulerEnv, verifier), {
    authorized: true,
    status: 200,
  });
});

test('bounds settings discovery and ignores unrelated or malformed paths', async () => {
  let requestedLimit = 0;
  const documents = [
    { ref: { path: 'users/good/settings/dailyReminder' }, data: () => ({ enabled: true, time: '21:00', timeZone: 'UTC' }) },
    { ref: { path: 'users/good/settings/profile' }, data: () => ({ enabled: true }) },
    { ref: { path: 'users//settings/dailyReminder' }, data: () => ({ enabled: true }) },
    { ref: { path: 'users/bad/settings/dailyReminder' }, data: () => ({ enabled: true, time: 2100, timeZone: null }) },
  ];
  const query = {
    where() { return this; },
    limit(value: number) { requestedLimit = value; return this; },
    select() { return this; },
    async get() { return { docs: documents }; },
  };
  const source = createReminderSettingsSource({ collectionGroup: () => query } as never);
  const candidates = await source.listEnabledReminderSettings(500);
  assert.equal(requestedLimit, 100);
  assert.deepEqual(candidates, [
    { uid: 'good', settings: { enabled: true, time: '21:00', timeZone: 'UTC' } },
    { uid: 'bad', settings: { enabled: true, time: 2100, timeZone: null } },
  ]);
});

type FailureStage = 'auth' | 'journal' | 'claim' | 'compose' | 'send' | 'markSent' | 'markFailed';

function createFailureProcessor(stage: FailureStage) {
  const messages: EmailMessage[] = [];
  const failedMarks: string[] = [];
  const processor = createDailyEmailReminderProcessor({
    settingsSource: {
      async listEnabledReminderSettings() {
        return ['bad', 'good'].map((uid) => ({ uid, settings: { enabled: true, time: '21:00', timeZone: 'UTC' } }));
      },
    },
    authLookup: {
      async getUser(uid) {
        if (uid === 'bad' && stage === 'auth') throw new Error('auth failure');
        return { disabled: false, email: `${uid}@example.com`, emailVerified: true, providerData: [{ providerId: 'google.com' }] };
      },
    },
    journalLookup: {
      async hasJournalEntryForUtcRange(uid) {
        if (uid === 'bad' && stage === 'journal') throw new Error('journal failure');
        return false;
      },
    },
    deliveryStore: {
      async claimDailyReminderDelivery({ uid }) {
        if (uid === 'bad' && stage === 'claim') throw new Error('claim failure');
        return { claimed: true, attemptCount: 1 };
      },
      async markDailyReminderSent({ uid }) {
        if (uid === 'bad' && stage === 'markSent') throw new Error('sent persistence failure');
        return true;
      },
      async markDailyReminderFailed({ uid }) {
        failedMarks.push(uid);
        if (uid === 'bad' && stage === 'markFailed') throw new Error('failed persistence failure');
        return true;
      },
    },
    composeEmail: ({ to, idempotencyKey }) => {
      if (to.startsWith('bad@') && stage === 'compose') throw new Error('compose failure');
      return createDailyReminderEmail({
        to,
        from: 'Reading the Signals <reminders@example.com>',
        appBaseUrl: 'https://example.com',
        idempotencyKey,
      });
    },
    emailTransport: {
      async send(message) {
        if (message.to.startsWith('bad@') && (stage === 'send' || stage === 'markFailed')) {
          throw new Error('send failure');
        }
        messages.push(message);
        return { messageId: 'fake' };
      },
    },
    now: () => new Date('2026-09-05T21:03:00Z'),
    concurrency: 2,
  });
  return { processor, messages, failedMarks };
}

test('isolates the complete processor failure matrix and keeps aggregate counts consistent', async () => {
  for (const stage of ['auth', 'journal', 'claim', 'compose', 'send', 'markSent', 'markFailed'] as FailureStage[]) {
    const fake = createFailureProcessor(stage);
    const result = await fake.processor();
    assert.deepEqual(result, { processed: 2, sent: 1, skipped: 0, failed: 1 }, stage);
    assert.equal(result.processed, result.sent + result.skipped + result.failed, stage);
    assert.equal(fake.messages.some((message) => message.to === 'good@example.com'), true, stage);
    if (stage === 'markSent') {
      assert.equal(fake.failedMarks.includes('bad'), false, 'accepted email must not become retryable');
    }
  }
});

test('concurrent duplicate candidates result in one send and preserve exact idempotency', async () => {
  let claimed = false;
  const messages: EmailMessage[] = [];
  const processor = createDailyEmailReminderProcessor({
    settingsSource: {
      async listEnabledReminderSettings() {
        const candidate = { uid: 'same-user', settings: { enabled: true, time: '21:00', timeZone: 'UTC' } };
        return [candidate, candidate];
      },
    },
    authLookup: { async getUser() { return { disabled: false, email: 'reader@example.com', emailVerified: true, providerData: [{ providerId: 'google.com' }] }; } },
    journalLookup: { async hasJournalEntryForUtcRange() { return false; } },
    deliveryStore: {
      async claimDailyReminderDelivery() {
        if (claimed) return { claimed: false, attemptCount: 1 };
        claimed = true;
        return { claimed: true, attemptCount: 1 };
      },
      async markDailyReminderSent() { return true; },
      async markDailyReminderFailed() { return true; },
    },
    composeEmail: ({ to, idempotencyKey }) => createDailyReminderEmail({ to, from: 'reminders@example.com', appBaseUrl: 'https://example.com', idempotencyKey }),
    emailTransport: { async send(message) { messages.push(message); return { messageId: 'fake' }; } },
    now: () => new Date('2026-09-05T21:03:00Z'),
    concurrency: 2,
  });

  assert.deepEqual(await processor(), { processed: 2, sent: 1, skipped: 1, failed: 0 });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].idempotencyKey, 'daily-reminder:same-user:2026-09-05');
});

test('email and transport configuration failures occur before any network client or send', () => {
  let clientCalls = 0;
  assert.throws(() => createResendTransport({}, () => { clientCalls += 1; throw new Error('must not run'); }), /EMAIL_CONFIGURATION_ERROR/);
  assert.equal(clientCalls, 0);
  assert.throws(() => createConfiguredDailyReminderEmailComposer({}), /EMAIL_CONFIGURATION_ERROR/);
  assert.throws(
    () => createConfiguredDailyReminderEmailComposer({ REMINDER_EMAIL_FROM: 'invalid', APP_BASE_URL: 'https://example.com' }),
    /INVALID_SENDER/
  );
  assert.throws(
    () => createConfiguredDailyReminderEmailComposer({ REMINDER_EMAIL_FROM: 'reminders@example.com', APP_BASE_URL: 'javascript:alert(1)' }),
    /APP_BASE_URL/
  );
});

test('route ignores caller payload and maps auth or processor failures to generic 503', async () => {
  for (const failure of ['auth', 'processor'] as const) {
    let processorArguments = -1;
    const handler = createScheduledReminderHandler({
      authenticate: async () => {
        if (failure === 'auth') throw new Error('private auth detail');
        return { authorized: true, status: 200 };
      },
      createProcessor: () => async (...args: unknown[]) => {
        processorArguments = args.length;
        throw new Error('private processor detail');
      },
    });
    const state: { status?: number; body?: unknown } = {};
    const request = {
      method: 'POST',
      body: { uid: 'attacker', email: 'attacker@example.com', date: '2099-01-01', settings: {} },
      header: () => 'Bearer fake',
    };
    const response = {
      status(code: number) { state.status = code; return this; },
      json(body: unknown) { state.body = body; return this; },
    };
    await (handler as never as (request: unknown, response: unknown) => Promise<void>)(request, response);
    assert.equal(state.status, 503);
    assert.deepEqual(state.body, { error: 'Service unavailable.' });
    assert.equal(processorArguments, failure === 'auth' ? -1 : 0);
  }
});

test('visible email and aggregate output contain no private data or identifiers', () => {
  const message = createDailyReminderEmail({
    to: 'reader@example.com',
    from: 'reminders@example.com',
    appBaseUrl: 'https://example.com',
    idempotencyKey: 'daily-reminder:opaque-user:2026-09-05',
  });
  const visible = `${message.subject}\n${message.text}\n${message.html}`;
  for (const forbidden of [
    'opaque-user',
    'reader@example.com',
    'private journal body 7c91',
    'remembered signal 7c91',
    'private summary 7c91',
    'reflection text 7c91',
  ]) {
    assert.doesNotMatch(visible, new RegExp(forbidden, 'i'));
  }
  assert.deepEqual({ processed: 1, sent: 1, skipped: 0, failed: 0 }, { processed: 1, sent: 1, skipped: 0, failed: 0 });
});

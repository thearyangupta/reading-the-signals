import assert from 'node:assert/strict';
import test from 'node:test';
import { createDailyReminderEmail } from '../email/dailyReminderEmail.ts';
import { EmailDeliveryError, type EmailMessage } from '../email/types.ts';
import type { ReminderAuthUser } from './authRecipient.ts';
import { createDailyEmailReminderProcessor } from './processDailyEmailReminders.ts';
import { createScheduledReminderHandler } from './scheduledRoute.ts';
import {
  authenticateSchedulerRequest,
  type SchedulerOidcClaims,
  type SchedulerTokenVerifier,
} from './schedulerAuth.ts';
import { extractUidFromDailyReminderPath } from './settingsStore.ts';
import type { ReminderSettingsCandidate } from './settingsStore.ts';

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

function fakeVerifier(result: SchedulerOidcClaims | Error): SchedulerTokenVerifier {
  return {
    async verify() {
      if (result instanceof Error) throw result;
      return result;
    },
  };
}

test('scheduler authentication rejects missing, invalid, and mismatched identities', async () => {
  assert.deepEqual(
    await authenticateSchedulerRequest(undefined, schedulerEnv, fakeVerifier(validClaims)),
    { authorized: false, status: 401 }
  );
  assert.deepEqual(
    await authenticateSchedulerRequest('Bearer invalid', schedulerEnv, fakeVerifier(new Error('invalid'))),
    { authorized: false, status: 401 }
  );
  assert.deepEqual(
    await authenticateSchedulerRequest(
      'Bearer signed',
      schedulerEnv,
      fakeVerifier({ ...validClaims, aud: 'https://wrong.example' })
    ),
    { authorized: false, status: 403 }
  );
  assert.deepEqual(
    await authenticateSchedulerRequest(
      'Bearer signed',
      schedulerEnv,
      fakeVerifier({ ...validClaims, email: 'wrong@example.iam.gserviceaccount.com' })
    ),
    { authorized: false, status: 403 }
  );
  assert.deepEqual(
    await authenticateSchedulerRequest(
      'Bearer signed',
      schedulerEnv,
      fakeVerifier({ ...validClaims, email_verified: false })
    ),
    { authorized: false, status: 403 }
  );
  assert.deepEqual(
    await authenticateSchedulerRequest(
      'Bearer signed',
      schedulerEnv,
      fakeVerifier({ ...validClaims, iss: 'https://issuer.example' })
    ),
    { authorized: false, status: 403 }
  );
  assert.deepEqual(
    await authenticateSchedulerRequest('Bearer signed', schedulerEnv, fakeVerifier(validClaims)),
    { authorized: true, status: 200 }
  );
});

interface FakeResponseState {
  status?: number;
  body?: unknown;
}

async function invokeHandler(method: string, authorization?: string, processResult = {
  processed: 0,
  sent: 0,
  skipped: 0,
  failed: 0,
}) {
  const state: FakeResponseState = {};
  let authenticateCalls = 0;
  let processorCalls = 0;
  const handler = createScheduledReminderHandler({
    authenticate: async () => {
      authenticateCalls += 1;
      return { authorized: true, status: 200 };
    },
    createProcessor: () => async () => {
      processorCalls += 1;
      return processResult;
    },
  });
  const request = {
    method,
    header: (name: string) => name.toLowerCase() === 'authorization' ? authorization : undefined,
  };
  const response = {
    status(code: number) {
      state.status = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  };
  await (handler as any)(request, response, () => undefined);
  return { state, authenticateCalls, processorCalls };
}

test('GET never authenticates or executes processing; valid POST returns aggregate counts', async () => {
  const getResult = await invokeHandler('GET');
  assert.equal(getResult.state.status, 405);
  assert.equal(getResult.authenticateCalls, 0);
  assert.equal(getResult.processorCalls, 0);

  const aggregate = { processed: 2, sent: 1, skipped: 1, failed: 0 };
  const postResult = await invokeHandler('POST', 'Bearer signed', aggregate);
  assert.equal(postResult.state.status, 200);
  assert.deepEqual(postResult.state.body, aggregate);
  assert.deepEqual(Object.keys(postResult.state.body as object).sort(), ['failed', 'processed', 'sent', 'skipped']);
  assert.equal(postResult.processorCalls, 1);
});

test('extracts only exact daily reminder document paths', () => {
  assert.equal(extractUidFromDailyReminderPath('users/user-1/settings/dailyReminder'), 'user-1');
  assert.equal(extractUidFromDailyReminderPath('users/user-1/settings/profile'), null);
  assert.equal(extractUidFromDailyReminderPath('other/user-1/settings/dailyReminder'), null);
  assert.equal(extractUidFromDailyReminderPath('users/user-1/settings/dailyReminder/extra'), null);
});

const dueSettings = { enabled: true, time: '21:00', timeZone: 'UTC' };
const verifiedUser = (email: string): ReminderAuthUser => ({
  disabled: false,
  email,
  emailVerified: true,
  providerData: [{ providerId: 'google.com' }],
});

function createFakeProcessor(input: {
  candidates: ReminderSettingsCandidate[];
  users?: Record<string, ReminderAuthUser | null>;
  journaledUids?: Set<string>;
  failEmailTo?: Set<string>;
}) {
  const messages: EmailMessage[] = [];
  const deliveryStates = new Map<string, 'claimed' | 'sent' | 'failed'>();
  const failedCodes = new Map<string, string>();
  let requestedBatchSize = 0;
  const processor = createDailyEmailReminderProcessor({
    settingsSource: {
      async listEnabledReminderSettings(limit) {
        requestedBatchSize = limit;
        return input.candidates;
      },
    },
    authLookup: {
      async getUser(uid) {
        return input.users?.[uid] ?? null;
      },
    },
    journalLookup: {
      async hasJournalEntryForUtcRange(uid) {
        return input.journaledUids?.has(uid) ?? false;
      },
    },
    deliveryStore: {
      async claimDailyReminderDelivery({ uid, localDate }) {
        const key = `${uid}:${localDate}`;
        if (deliveryStates.has(key)) return { claimed: false, attemptCount: 1 };
        deliveryStates.set(key, 'claimed');
        return { claimed: true, attemptCount: 1 };
      },
      async markDailyReminderSent({ uid, localDate }) {
        const key = `${uid}:${localDate}`;
        if (deliveryStates.get(key) !== 'claimed') return false;
        deliveryStates.set(key, 'sent');
        return true;
      },
      async markDailyReminderFailed({ uid, localDate }, errorCode) {
        const key = `${uid}:${localDate}`;
        if (deliveryStates.get(key) !== 'claimed') return false;
        deliveryStates.set(key, 'failed');
        failedCodes.set(key, errorCode);
        return true;
      },
    },
    emailTransport: {
      async send(message) {
        if (input.failEmailTo?.has(message.to)) throw new EmailDeliveryError('RESEND_RATE_LIMIT_EXCEEDED');
        messages.push(message);
        return { messageId: `fake-${messages.length}` };
      },
    },
    composeEmail: ({ to, idempotencyKey }) => createDailyReminderEmail({
      to,
      from: 'Reading the Signals <reminders@example.com>',
      appBaseUrl: 'https://example.com/',
      idempotencyKey,
    }),
    now: () => new Date('2026-09-05T21:03:00Z'),
    concurrency: 2,
  });
  return { processor, messages, deliveryStates, failedCodes, getRequestedBatchSize: () => requestedBatchSize };
}

test('skips disabled, invalid, and not-yet-due settings before Auth lookup', async () => {
  const fake = createFakeProcessor({
    candidates: [
      { uid: 'disabled', settings: { ...dueSettings, enabled: false } },
      { uid: 'invalid', settings: { ...dueSettings, time: '29:00' } },
      { uid: 'early', settings: { ...dueSettings, time: '22:00' } },
    ],
  });
  assert.deepEqual(await fake.processor(), { processed: 3, sent: 0, skipped: 3, failed: 0 });
  assert.equal(fake.messages.length, 0);
});

test('skips anonymous, disabled, missing-email, and unverified Auth users', async () => {
  const candidates = ['anonymous', 'disabled-auth', 'missing-email', 'unverified'].map((uid) => ({
    uid,
    settings: dueSettings,
  }));
  const fake = createFakeProcessor({
    candidates,
    users: {
      anonymous: { ...verifiedUser('anonymous@example.com'), providerData: [] },
      'disabled-auth': { ...verifiedUser('disabled@example.com'), disabled: true },
      'missing-email': { ...verifiedUser('missing@example.com'), email: undefined },
      unverified: { ...verifiedUser('unverified@example.com'), emailVerified: false },
    },
  });
  assert.deepEqual(await fake.processor(), { processed: 4, sent: 0, skipped: 4, failed: 0 });
  assert.equal(fake.messages.length, 0);
});

test('skips a verified user who already journaled today', async () => {
  const fake = createFakeProcessor({
    candidates: [{ uid: 'journaled', settings: dueSettings }],
    users: { journaled: verifiedUser('journaled@example.com') },
    journaledUids: new Set(['journaled']),
  });
  assert.deepEqual(await fake.processor(), { processed: 1, sent: 0, skipped: 1, failed: 0 });
  assert.equal(fake.deliveryStates.size, 0);
});

test('sends once, marks sent, and rejects a duplicate delivery claim', async () => {
  const fake = createFakeProcessor({
    candidates: [{ uid: 'eligible', settings: dueSettings }],
    users: { eligible: verifiedUser('eligible@example.com') },
  });
  assert.deepEqual(await fake.processor(), { processed: 1, sent: 1, skipped: 0, failed: 0 });
  assert.deepEqual(await fake.processor(), { processed: 1, sent: 0, skipped: 1, failed: 0 });
  assert.equal(fake.messages.length, 1);
  assert.equal(fake.deliveryStates.get('eligible:2026-09-05'), 'sent');
  assert.equal(fake.messages[0].idempotencyKey, 'daily-reminder:eligible:2026-09-05');
  assert.match(fake.messages[0].text, /https:\/\/example\.com\/write/);
  assert.doesNotMatch(fake.messages[0].text + fake.messages[0].html, /private journal body/i);
  assert.equal(fake.getRequestedBatchSize(), 100);
});

test('isolates one email failure, marks it failed safely, and continues another user', async () => {
  const fake = createFakeProcessor({
    candidates: [
      { uid: 'fails', settings: dueSettings },
      { uid: 'succeeds', settings: dueSettings },
    ],
    users: {
      fails: verifiedUser('fails@example.com'),
      succeeds: verifiedUser('succeeds@example.com'),
    },
    failEmailTo: new Set(['fails@example.com']),
  });
  assert.deepEqual(await fake.processor(), { processed: 2, sent: 1, skipped: 0, failed: 1 });
  assert.equal(fake.deliveryStates.get('fails:2026-09-05'), 'failed');
  assert.equal(fake.failedCodes.get('fails:2026-09-05'), 'RESEND_RATE_LIMIT_EXCEEDED');
  assert.equal(fake.deliveryStates.get('succeeds:2026-09-05'), 'sent');
  assert.equal(fake.messages.length, 1);
});

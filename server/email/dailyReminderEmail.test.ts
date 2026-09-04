import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailyReminderEmail,
  createDailyReminderIdempotencyKey,
  DAILY_REMINDER_SUBJECT,
} from './dailyReminderEmail.ts';
import { createResendTransport } from './resendTransport.ts';
import { EmailDeliveryError, type EmailMessage, type EmailTransport } from './types.ts';

const baseInput = {
  to: 'reader@example.com',
  from: 'Reading the Signals <reminders@example.com>',
  appBaseUrl: 'https://example.com',
};

class RecordingEmailTransport implements EmailTransport {
  readonly messages: EmailMessage[] = [];

  async send(message: EmailMessage) {
    this.messages.push(message);
    return { messageId: 'fake-message-1' };
  }
}

test('composes the privacy-safe daily reminder in text and HTML', () => {
  const message = createDailyReminderEmail(baseInput);
  assert.equal(message.subject, DAILY_REMINDER_SUBJECT);
  assert.match(message.text, /A signal is missing today\.\nTake a moment to reflect on your day\./);
  assert.match(message.html, /A signal is missing today\./);
  assert.match(message.html, /Take a moment to reflect on your day\./);
  assert.match(message.html, /Write today&#39;s reflection/);
  assert.match(message.text, /https:\/\/example\.com\/write/);
  assert.match(message.html, /href="https:\/\/example\.com\/write"/);
  assert.doesNotMatch(message.text + message.html, /private journal entry body/i);
});

test('normalizes a trailing slash to exactly one write path', () => {
  const message = createDailyReminderEmail({ ...baseInput, appBaseUrl: 'https://example.com/' });
  assert.match(message.text, /https:\/\/example\.com\/write/);
  assert.doesNotMatch(message.text, /example\.com\/\/write/);
});

test('rejects unsafe base URLs and obviously invalid recipients', () => {
  assert.throws(
    () => createDailyReminderEmail({ ...baseInput, appBaseUrl: 'ftp://example.com' }),
    /HTTP or HTTPS/
  );
  assert.throws(
    () => createDailyReminderEmail({ ...baseInput, appBaseUrl: 'http://example.com' }),
    /HTTPS outside local development/
  );
  assert.throws(
    () => createDailyReminderEmail({ ...baseInput, to: 'not-an-email' }),
    (error: unknown) => error instanceof EmailDeliveryError && error.code === 'INVALID_RECIPIENT'
  );
  assert.throws(
    () => createDailyReminderEmail({ ...baseInput, to: '' }),
    (error: unknown) => error instanceof EmailDeliveryError && error.code === 'INVALID_RECIPIENT'
  );
});

test('passes a deterministic idempotency key through a fake transport once', async () => {
  const idempotencyKey = createDailyReminderIdempotencyKey('user-123', '2026-09-05');
  const message = createDailyReminderEmail({ ...baseInput, idempotencyKey });
  const transport = new RecordingEmailTransport();
  await transport.send(message);

  assert.equal(idempotencyKey, 'daily-reminder:user-123:2026-09-05');
  assert.equal(transport.messages.length, 1);
  assert.equal(transport.messages[0].idempotencyKey, idempotencyKey);
  assert.doesNotMatch(transport.messages[0].text + transport.messages[0].html, /user-123/);
});

test('maps fake Resend failures to a safe code without constructing a real client', async () => {
  let fakeFactoryCalls = 0;
  const transport = createResendTransport(
    { RESEND_API_KEY: 'test-only-placeholder' },
    () => {
      fakeFactoryCalls += 1;
      return {
        emails: {
          send: async () => ({
            data: null,
            error: { name: 'rate_limit_exceeded', message: 'sensitive provider detail' },
          }),
        },
      };
    }
  );

  await assert.rejects(
    transport.send(createDailyReminderEmail(baseInput)),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.code === 'RESEND_RATE_LIMIT_EXCEEDED' &&
      !error.message.includes('sensitive provider detail')
  );
  assert.equal(fakeFactoryCalls, 1);
});

test('passes idempotency to the Resend SDK options using an injected fake client', async () => {
  const capturedOptions: Array<{ idempotencyKey?: string } | undefined> = [];
  const transport = createResendTransport(
    { RESEND_API_KEY: 'test-only-placeholder' },
    () => ({
      emails: {
        send: async (_message, options) => {
          capturedOptions.push(options);
          return { data: { id: 'fake-resend-id' }, error: null };
        },
      },
    })
  );
  const idempotencyKey = createDailyReminderIdempotencyKey('user-123', '2026-09-05');
  const result = await transport.send(createDailyReminderEmail({ ...baseInput, idempotencyKey }));

  assert.deepEqual(result, { messageId: 'fake-resend-id' });
  assert.deepEqual(capturedOptions, [{ idempotencyKey }]);
});

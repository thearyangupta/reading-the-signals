import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailyReminderEmail,
  createDailyReminderIdempotencyKey,
  DAILY_REMINDER_SUBJECT,
} from './dailyReminderEmail.ts';
import {
  createResendProviderDiagnostic,
  createResendTransport,
  sanitizeProviderMessage,
} from './resendTransport.ts';
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

function fakeJsonResponse(status: number, body: unknown, statusText = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  } as unknown as Response;
}

test('sends via direct fetch to the Resend API, preserving the idempotency header, and returns the message id', async () => {
  const capturedRequests: Array<{ url: string; init: RequestInit }> = [];
  const transport = createResendTransport(
    { RESEND_API_KEY: 'test-only-placeholder' },
    (async (url: string, init?: RequestInit) => {
      capturedRequests.push({ url: String(url), init: init! });
      return fakeJsonResponse(200, { id: 'fake-resend-id' });
    }) as typeof fetch
  );
  const idempotencyKey = createDailyReminderIdempotencyKey('user-123', '2026-09-05');
  const result = await transport.send(createDailyReminderEmail({ ...baseInput, idempotencyKey }));

  assert.deepEqual(result, { messageId: 'fake-resend-id' });
  assert.equal(capturedRequests.length, 1);
  assert.equal(capturedRequests[0].url, 'https://api.resend.com/emails');
  assert.equal(capturedRequests[0].init.method, 'POST');
  const headers = capturedRequests[0].init.headers as Record<string, string>;
  assert.equal(headers['Idempotency-Key'], idempotencyKey);
  assert.equal(headers['Authorization'], 'Bearer test-only-placeholder');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.doesNotMatch(String(capturedRequests[0].init.body), /user-123/);
});

test('maps a non-2xx Resend HTTP response to a safe code with sanitized diagnostics', async () => {
  const transport = createResendTransport(
    { RESEND_API_KEY: 'test-only-placeholder' },
    (async () => fakeJsonResponse(503, { name: 'application_error', message: 'Provider unavailable', statusCode: 503 })) as typeof fetch
  );

  await assert.rejects(
    transport.send(createDailyReminderEmail(baseInput)),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.code === 'RESEND_APPLICATION_ERROR' &&
      error.providerDiagnostic?.statusCode === 503 &&
      error.providerDiagnostic.message === 'Provider unavailable'
  );
});

test('maps 401/403/422-style Resend HTTP error responses to distinct safe codes', async () => {
  const cases: Array<{ status: number; name: string; message: string; expectedCode: string }> = [
    { status: 401, name: 'restricted_api_key', message: 'Invalid API key', expectedCode: 'RESEND_RESTRICTED_API_KEY' },
    { status: 403, name: 'forbidden', message: 'Not allowed', expectedCode: 'RESEND_FORBIDDEN' },
    { status: 422, name: 'validation_error', message: 'Invalid `to` field', expectedCode: 'RESEND_VALIDATION_ERROR' },
  ];

  for (const testCase of cases) {
    const transport = createResendTransport(
      { RESEND_API_KEY: 'test-only-placeholder' },
      (async () =>
        fakeJsonResponse(testCase.status, {
          name: testCase.name,
          message: testCase.message,
          statusCode: testCase.status,
        })) as typeof fetch
    );

    await assert.rejects(
      transport.send(createDailyReminderEmail(baseInput)),
      (error: unknown) =>
        error instanceof EmailDeliveryError &&
        error.code === testCase.expectedCode &&
        error.providerDiagnostic?.statusCode === testCase.status &&
        error.providerDiagnostic.message === testCase.message
    );
  }
});

test('sanitizes and bounds Resend provider diagnostics', () => {
  const unsafe = 'Bearer token.value api_key=secret-value reader@example.com ' + 'x'.repeat(400);
  const message = sanitizeProviderMessage(unsafe);
  assert.ok(message.length <= 240);
  assert.doesNotMatch(message, /token\.value|secret-value|reader@example\.com/);
  assert.match(message, /\[REDACTED/);
  assert.deepEqual(createResendProviderDiagnostic({ name: 'application_error', statusCode: 502, message: 'Safe failure' }), {
    provider: 'resend',
    errorName: 'application_error',
    statusCode: 502,
    message: 'Safe failure',
  });
});

test('never leaks the API key into thrown provider diagnostics', async () => {
  const secretApiKey = 're_super_secret_test_key_do_not_leak';
  const transport = createResendTransport(
    { RESEND_API_KEY: secretApiKey },
    (async () =>
      fakeJsonResponse(401, {
        name: 'restricted_api_key',
        message: `Bearer ${secretApiKey} was rejected`,
        statusCode: 401,
      })) as typeof fetch
  );

  await assert.rejects(
    transport.send(createDailyReminderEmail(baseInput)),
    (error: unknown) => {
      if (!(error instanceof EmailDeliveryError)) return false;
      const serialized = JSON.stringify(error.providerDiagnostic ?? {});
      return !serialized.includes(secretApiKey);
    }
  );
});

test('keeps fetch/network rejections mapped to RESEND_REQUEST_FAILED without provider diagnostics', async () => {
  const transport = createResendTransport(
    { RESEND_API_KEY: 'test-only-placeholder' },
    (async () => { throw new Error('network detail'); }) as typeof fetch
  );
  await assert.rejects(
    transport.send(createDailyReminderEmail(baseInput)),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.code === 'RESEND_REQUEST_FAILED' &&
      error.providerDiagnostic === undefined
  );
});

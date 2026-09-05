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

import { EventEmitter } from 'node:events';

interface CapturedRequest {
  options: Record<string, unknown>;
  writtenBody: string;
}

function fakeHttpsRequest(outcome: { statusCode: number; body: string } | { networkError: Error }) {
  const captured: CapturedRequest[] = [];
  const requestImpl = (options: Record<string, unknown>, callback: (res: any) => void) => {
    const req = new EventEmitter() as any;
    const record: CapturedRequest = { options, writtenBody: '' };
    captured.push(record);
    req.write = (chunk: string) => {
      record.writtenBody += chunk;
    };
    req.destroy = (error?: Error) => {
      if (error) queueMicrotask(() => req.emit('error', error));
    };
    req.end = () => {
      queueMicrotask(() => {
        if ('networkError' in outcome) {
          req.emit('error', outcome.networkError);
          return;
        }
        const res = new EventEmitter() as any;
        res.statusCode = outcome.statusCode;
        res.setEncoding = () => {};
        callback(res);
        queueMicrotask(() => {
          res.emit('data', outcome.body);
          res.emit('end');
        });
      });
    };
    return req;
  };
  return { requestImpl, captured };
}

test('sends via native https.request to the Resend API, forcing IPv4 and preserving the idempotency header', async () => {
  const { requestImpl, captured } = fakeHttpsRequest({ statusCode: 200, body: JSON.stringify({ id: 'fake-resend-id' }) });
  const transport = createResendTransport({ RESEND_API_KEY: 'test-only-placeholder' }, requestImpl as any);
  const idempotencyKey = createDailyReminderIdempotencyKey('user-123', '2026-09-05');
  const result = await transport.send(createDailyReminderEmail({ ...baseInput, idempotencyKey }));

  assert.deepEqual(result, { messageId: 'fake-resend-id' });
  assert.equal(captured.length, 1);
  assert.equal(captured[0].options.hostname, 'api.resend.com');
  assert.equal(captured[0].options.path, '/emails');
  assert.equal(captured[0].options.method, 'POST');
  assert.equal(captured[0].options.family, 4);
  const headers = captured[0].options.headers as Record<string, string>;
  assert.equal(headers['Idempotency-Key'], idempotencyKey);
  assert.equal(headers['Authorization'], 'Bearer test-only-placeholder');
  assert.equal(headers['Content-Type'], 'application/json');
  assert.doesNotMatch(captured[0].writtenBody, /user-123/);
});

test('maps a non-2xx Resend HTTP response to a safe code with sanitized diagnostics', async () => {
  const { requestImpl } = fakeHttpsRequest({
    statusCode: 503,
    body: JSON.stringify({ name: 'application_error', message: 'Provider unavailable', statusCode: 503 }),
  });
  const transport = createResendTransport({ RESEND_API_KEY: 'test-only-placeholder' }, requestImpl as any);

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
    const { requestImpl } = fakeHttpsRequest({
      statusCode: testCase.status,
      body: JSON.stringify({ name: testCase.name, message: testCase.message, statusCode: testCase.status }),
    });
    const transport = createResendTransport({ RESEND_API_KEY: 'test-only-placeholder' }, requestImpl as any);

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
  const { requestImpl } = fakeHttpsRequest({
    statusCode: 401,
    body: JSON.stringify({ name: 'restricted_api_key', message: `Bearer ${secretApiKey} was rejected`, statusCode: 401 }),
  });
  const transport = createResendTransport({ RESEND_API_KEY: secretApiKey }, requestImpl as any);

  await assert.rejects(
    transport.send(createDailyReminderEmail(baseInput)),
    (error: unknown) => {
      if (!(error instanceof EmailDeliveryError)) return false;
      const serialized = JSON.stringify(error.providerDiagnostic ?? {});
      return !serialized.includes(secretApiKey);
    }
  );
});

test('maps a network/socket rejection to RESEND_REQUEST_FAILED with a sanitized network cause', async () => {
  const networkError = Object.assign(new Error('connect ECONNRESET 1.2.3.4:443'), { code: 'ECONNRESET' });
  const { requestImpl } = fakeHttpsRequest({ networkError });
  const transport = createResendTransport({ RESEND_API_KEY: 'test-only-placeholder' }, requestImpl as any);

  await assert.rejects(
    transport.send(createDailyReminderEmail(baseInput)),
    (error: unknown) =>
      error instanceof EmailDeliveryError &&
      error.code === 'RESEND_REQUEST_FAILED' &&
      error.providerDiagnostic?.errorName === 'econnreset' &&
      error.providerDiagnostic.statusCode === null &&
      /ECONNRESET/.test(error.providerDiagnostic.message) &&
      !JSON.stringify(error.providerDiagnostic).includes('test-only-placeholder')
  );
});

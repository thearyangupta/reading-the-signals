import {
  assertValidEmailMessage,
  EmailDeliveryError,
  type EmailMessage,
} from './types.ts';

export const DAILY_REMINDER_SUBJECT = 'A signal is missing today.';

function normalizeAppBaseUrl(appBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(appBaseUrl);
  } catch {
    throw new Error('APP_BASE_URL must be a valid absolute URL.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('APP_BASE_URL must use HTTP or HTTPS.');
  }
  const isLocalDevelopment = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocalDevelopment) {
    throw new Error('APP_BASE_URL must use HTTPS outside local development.');
  }
  if (url.username || url.password) throw new Error('APP_BASE_URL must not contain credentials.');

  url.search = '';
  url.hash = '';
  url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createDailyReminderIdempotencyKey(uid: string, localDate: string): string {
  if (!uid.trim() || uid.includes(':')) throw new Error('A valid uid is required for email idempotency.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error('A YYYY-MM-DD local date is required for email idempotency.');
  }
  return `daily-reminder:${uid}:${localDate}`;
}

export function createDailyReminderEmail(input: {
  to: string;
  from: string;
  appBaseUrl: string;
  idempotencyKey?: string;
}): EmailMessage {
  const writeUrl = `${normalizeAppBaseUrl(input.appBaseUrl)}/write`;
  const text = [
    'Reading the Signals',
    '',
    DAILY_REMINDER_SUBJECT,
    'Take a moment to reflect on your day.',
    '',
    `Write today's reflection: ${writeUrl}`,
  ].join('\n');
  const safeWriteUrl = escapeHtml(writeUrl);
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f0ebfa;color:#463a54;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:48px 24px;">
      <p style="margin:0 0 24px;color:#746a80;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;">Reading the Signals</p>
      <h1 style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:30px;line-height:1.2;font-weight:600;color:#463a54;">A signal is missing today.</h1>
      <p style="margin:0 0 28px;font-size:16px;line-height:1.6;color:#746a80;">Take a moment to reflect on your day.</p>
      <a href="${safeWriteUrl}" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#a64063;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;">Write today&#39;s reflection</a>
      <p style="margin:32px 0 0;font-size:12px;line-height:1.6;color:#958a9f;">This reminder contains no journal content.</p>
    </div>
  </body>
</html>`;

  const message: EmailMessage = {
    to: input.to.trim(),
    from: input.from.trim(),
    subject: DAILY_REMINDER_SUBJECT,
    text,
    html,
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  assertValidEmailMessage(message);
  return message;
}

export function createConfiguredDailyReminderEmail(
  input: { to: string; idempotencyKey?: string },
  env: NodeJS.ProcessEnv = process.env
): EmailMessage {
  const from = env.REMINDER_EMAIL_FROM?.trim();
  const appBaseUrl = env.APP_BASE_URL?.trim();
  if (!from || !appBaseUrl) throw new EmailDeliveryError('EMAIL_CONFIGURATION_ERROR');
  return createDailyReminderEmail({ ...input, from, appBaseUrl });
}

export function createConfiguredDailyReminderEmailComposer(env: NodeJS.ProcessEnv = process.env) {
  const from = env.REMINDER_EMAIL_FROM?.trim();
  const appBaseUrl = env.APP_BASE_URL?.trim();
  if (!from || !appBaseUrl) throw new EmailDeliveryError('EMAIL_CONFIGURATION_ERROR');

  createDailyReminderEmail({ to: 'configuration-check@example.com', from, appBaseUrl });
  return (input: { to: string; idempotencyKey?: string }): EmailMessage =>
    createDailyReminderEmail({ ...input, from, appBaseUrl });
}

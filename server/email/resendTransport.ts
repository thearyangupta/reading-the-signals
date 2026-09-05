import https from 'node:https';
import type { ClientRequest, IncomingMessage } from 'node:http';
import {
  assertValidEmailMessage,
  EmailDeliveryError,
  type EmailMessage,
  type EmailSendResult,
  type EmailTransport,
} from './types.ts';

const RESEND_HOSTNAME = 'api.resend.com';
const RESEND_PATH = '/emails';
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_PROVIDER_MESSAGE_LENGTH = 240;

interface ResendErrorPayload {
  name?: string;
  message?: string;
  statusCode?: number | null;
}

type HttpsRequestLike = (
  options: https.RequestOptions,
  callback: (res: IncomingMessage) => void
) => ClientRequest;

function sanitizeProviderErrorName(name: string | undefined): string {
  return String(name || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48) || 'unknown';
}

export function sanitizeProviderMessage(message: unknown): string {
  if (typeof message !== 'string' || !message.trim()) return 'Provider request failed.';
  return message
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(api[ _-]?key|authorization|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .replace(/\bre_[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_CREDENTIAL]')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[REDACTED_EMAIL]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PROVIDER_MESSAGE_LENGTH);
}

export function createResendProviderDiagnostic(error: ResendErrorPayload) {
  return {
    provider: 'resend' as const,
    errorName: sanitizeProviderErrorName(error.name),
    statusCode: typeof error.statusCode === 'number' && Number.isFinite(error.statusCode)
      ? error.statusCode
      : null,
    message: sanitizeProviderMessage(error.message),
  };
}

function safeProviderErrorCode(name: string | undefined): string {
  const suffix = String(name || 'REJECTED')
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return `RESEND_${suffix || 'REJECTED'}`;
}

function createNetworkFailureDiagnostic(error: unknown) {
  const err = error instanceof Error ? error : undefined;
  const code = err && typeof (err as NodeJS.ErrnoException).code === 'string'
    ? (err as NodeJS.ErrnoException).code
    : undefined;
  return createResendProviderDiagnostic({
    name: code || err?.name || 'network_error',
    message: err?.message,
    statusCode: null,
  });
}

function requestResend(
  requestImpl: HttpsRequestLike,
  headers: Record<string, string>,
  payload: string
): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = requestImpl(
      {
        hostname: RESEND_HOSTNAME,
        path: RESEND_PATH,
        method: 'POST',
        headers,
        family: 4,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          raw += chunk;
        });
        res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body: raw }));
      }
    );
    req.on('timeout', () => req.destroy(Object.assign(new Error('Resend request timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

export function createResendTransport(
  env: NodeJS.ProcessEnv = process.env,
  requestImpl: HttpsRequestLike = https.request as unknown as HttpsRequestLike
): EmailTransport {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailDeliveryError('EMAIL_CONFIGURATION_ERROR');

  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      assertValidEmailMessage(message);

      const payload = JSON.stringify({
        from: message.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(payload)),
      };
      if (message.idempotencyKey) headers['Idempotency-Key'] = message.idempotencyKey;

      let statusCode: number;
      let body: string;
      try {
        ({ statusCode, body } = await requestResend(requestImpl, headers, payload));
      } catch (error) {
        throw new EmailDeliveryError('RESEND_REQUEST_FAILED', createNetworkFailureDiagnostic(error));
      }

      let parsed: unknown = null;
      try {
        parsed = body ? JSON.parse(body) : null;
      } catch {
        parsed = null;
      }

      if (statusCode < 200 || statusCode >= 300) {
        const errorPayload: ResendErrorPayload = parsed && typeof parsed === 'object'
          ? {
              name: typeof (parsed as any).name === 'string' ? (parsed as any).name : undefined,
              message: typeof (parsed as any).message === 'string' ? (parsed as any).message : undefined,
              statusCode: typeof (parsed as any).statusCode === 'number' ? (parsed as any).statusCode : statusCode,
            }
          : { name: undefined, message: undefined, statusCode };
        throw new EmailDeliveryError(
          safeProviderErrorCode(errorPayload.name),
          createResendProviderDiagnostic(errorPayload)
        );
      }

      const messageId = parsed && typeof parsed === 'object' ? (parsed as { id?: unknown }).id : undefined;
      if (typeof messageId !== 'string' || !messageId) throw new EmailDeliveryError('RESEND_MISSING_MESSAGE_ID');
      return { messageId };
    },
  };
}

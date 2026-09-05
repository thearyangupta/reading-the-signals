import {
  assertValidEmailMessage,
  EmailDeliveryError,
  type EmailMessage,
  type EmailSendResult,
  type EmailTransport,
} from './types.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_PROVIDER_MESSAGE_LENGTH = 240;

type FetchLike = typeof fetch;

interface ResendErrorPayload {
  name?: string;
  message?: string;
  statusCode?: number | null;
}

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

async function parseResendErrorPayload(response: Response): Promise<ResendErrorPayload> {
  try {
    const parsed = await response.json();
    if (parsed && typeof parsed === 'object') {
      return {
        name: typeof (parsed as any).name === 'string' ? (parsed as any).name : undefined,
        message: typeof (parsed as any).message === 'string' ? (parsed as any).message : response.statusText,
        statusCode: typeof (parsed as any).statusCode === 'number' ? (parsed as any).statusCode : response.status,
      };
    }
  } catch {
    // Fall through to the generic HTTP-status-derived payload below.
  }
  return { name: undefined, message: response.statusText, statusCode: response.status };
}

export function createResendTransport(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch
): EmailTransport {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailDeliveryError('EMAIL_CONFIGURATION_ERROR');

  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      assertValidEmailMessage(message);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };
      if (message.idempotencyKey) headers['Idempotency-Key'] = message.idempotencyKey;

      let response: Response;
      try {
        response = await fetchImpl(RESEND_API_URL, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            from: message.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          }),
        });
      } catch {
        throw new EmailDeliveryError('RESEND_REQUEST_FAILED');
      }

      if (!response.ok) {
        const errorPayload = await parseResendErrorPayload(response);
        throw new EmailDeliveryError(
          safeProviderErrorCode(errorPayload.name),
          createResendProviderDiagnostic(errorPayload)
        );
      }

      let data: unknown;
      try {
        data = await response.json();
      } catch {
        throw new EmailDeliveryError('RESEND_REQUEST_FAILED');
      }

      const messageId = data && typeof data === 'object' ? (data as { id?: unknown }).id : undefined;
      if (typeof messageId !== 'string' || !messageId) throw new EmailDeliveryError('RESEND_MISSING_MESSAGE_ID');
      return { messageId };
    },
  };
}

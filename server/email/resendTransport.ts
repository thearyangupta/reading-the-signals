import { Resend } from 'resend';
import {
  assertValidEmailMessage,
  EmailDeliveryError,
  type EmailMessage,
  type EmailSendResult,
  type EmailTransport,
} from './types.ts';

interface ResendClient {
  emails: {
    send(
      message: Pick<EmailMessage, 'from' | 'to' | 'subject' | 'text' | 'html'>,
      options?: { idempotencyKey?: string }
    ): Promise<{
      data: { id: string } | null;
      error: { name?: string; message?: string; statusCode?: number | null } | null;
    }>;
  };
}

type ResendClientFactory = (apiKey: string) => ResendClient;

const MAX_PROVIDER_MESSAGE_LENGTH = 240;

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

export function createResendProviderDiagnostic(error: {
  name?: string;
  message?: string;
  statusCode?: number | null;
}) {
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

export function createResendTransport(
  env: NodeJS.ProcessEnv = process.env,
  createClient: ResendClientFactory = (apiKey) => new Resend(apiKey) as ResendClient
): EmailTransport {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new EmailDeliveryError('EMAIL_CONFIGURATION_ERROR');
  const client = createClient(apiKey);

  return {
    async send(message: EmailMessage): Promise<EmailSendResult> {
      assertValidEmailMessage(message);
      try {
        const { data, error } = await client.emails.send(
          {
            from: message.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            html: message.html,
          },
          message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined
        );
        if (error) {
          throw new EmailDeliveryError(
            safeProviderErrorCode(error.name),
            createResendProviderDiagnostic(error)
          );
        }
        if (!data?.id) throw new EmailDeliveryError('RESEND_MISSING_MESSAGE_ID');
        return { messageId: data.id };
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        throw new EmailDeliveryError('RESEND_REQUEST_FAILED');
      }
    },
  };
}

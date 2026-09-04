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
      error: { name?: string } | null;
    }>;
  };
}

type ResendClientFactory = (apiKey: string) => ResendClient;

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
        if (error) throw new EmailDeliveryError(safeProviderErrorCode(error.name));
        if (!data?.id) throw new EmailDeliveryError('RESEND_MISSING_MESSAGE_ID');
        return { messageId: data.id };
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        throw new EmailDeliveryError('RESEND_REQUEST_FAILED');
      }
    },
  };
}

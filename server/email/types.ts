export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey?: string;
}

export interface EmailSendResult {
  messageId?: string;
}

export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface EmailProviderDiagnostic {
  provider: 'resend';
  errorName: string;
  statusCode: number | null;
  message: string;
}

export class EmailDeliveryError extends Error {
  readonly code: string;
  readonly providerDiagnostic?: EmailProviderDiagnostic;

  constructor(code: string, providerDiagnostic?: EmailProviderDiagnostic) {
    super(code);
    this.name = 'EmailDeliveryError';
    this.code = code;
    this.providerDiagnostic = providerDiagnostic;
  }
}

const BASIC_EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function isBasicEmailAddress(value: string): boolean {
  return BASIC_EMAIL_PATTERN.test(value.trim());
}

export function isBasicSenderAddress(value: string): boolean {
  const trimmed = value.trim();
  const bracketMatch = trimmed.match(/^[^<>]+<([^<>]+)>$/);
  return isBasicEmailAddress(bracketMatch?.[1] ?? trimmed);
}

export function assertValidEmailMessage(message: EmailMessage): void {
  if (!isBasicEmailAddress(message.to)) throw new EmailDeliveryError('INVALID_RECIPIENT');
  if (!isBasicSenderAddress(message.from)) throw new EmailDeliveryError('INVALID_SENDER');
  if (!message.subject.trim() || !message.text.trim() || !message.html.trim()) {
    throw new EmailDeliveryError('INVALID_MESSAGE');
  }
  if (
    message.idempotencyKey !== undefined &&
    (!message.idempotencyKey.trim() || message.idempotencyKey.length > 256)
  ) {
    throw new EmailDeliveryError('INVALID_IDEMPOTENCY_KEY');
  }
}

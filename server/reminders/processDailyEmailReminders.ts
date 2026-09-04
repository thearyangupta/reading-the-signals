import { createDailyReminderIdempotencyKey } from '../email/dailyReminderEmail.ts';
import { EmailDeliveryError, type EmailMessage, type EmailTransport } from '../email/types.ts';
import { getEligibleReminderRecipient, type ReminderAuthLookup } from './authRecipient.ts';
import type { ClaimDailyReminderDeliveryResult, ReminderDeliveryIdentity } from './deliveryStore.ts';
import { evaluateDailyReminderEligibility, getReminderEligibilityContext } from './eligibility.ts';
import type { ReminderSettingsSource } from './settingsStore.ts';

export interface ReminderDeliveryOperations {
  claimDailyReminderDelivery(input: {
    uid: string;
    localDate: string;
    timeZone: string;
    reminderTime: string;
  }): Promise<ClaimDailyReminderDeliveryResult>;
  markDailyReminderSent(identity: ReminderDeliveryIdentity): Promise<boolean>;
  markDailyReminderFailed(identity: ReminderDeliveryIdentity, errorCode: string): Promise<boolean>;
}

export interface JournalEntryExistenceLookup {
  hasJournalEntryForUtcRange(uid: string, startUtcMs: number, endUtcMs: number): Promise<boolean>;
}

export interface DailyReminderBatchResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

interface DailyReminderProcessorDependencies {
  settingsSource: ReminderSettingsSource;
  authLookup: ReminderAuthLookup;
  journalLookup: JournalEntryExistenceLookup;
  deliveryStore: ReminderDeliveryOperations;
  emailTransport: EmailTransport;
  composeEmail(input: { to: string; idempotencyKey: string }): EmailMessage;
  now(): Date;
  batchSize?: number;
  concurrency?: number;
}

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_CONCURRENCY = 5;

function safeFailureCode(error: unknown): string {
  return error instanceof EmailDeliveryError ? error.code : 'REMINDER_PROCESSING_FAILED';
}

export function createDailyEmailReminderProcessor(dependencies: DailyReminderProcessorDependencies) {
  const batchSize = Math.min(Math.max(dependencies.batchSize ?? DEFAULT_BATCH_SIZE, 1), DEFAULT_BATCH_SIZE);
  const concurrency = Math.min(Math.max(dependencies.concurrency ?? DEFAULT_CONCURRENCY, 1), 10);

  return async function processDailyEmailReminders(): Promise<DailyReminderBatchResult> {
    const candidates = await dependencies.settingsSource.listEnabledReminderSettings(batchSize);
    const result: DailyReminderBatchResult = { processed: candidates.length, sent: 0, skipped: 0, failed: 0 };
    let nextIndex = 0;

    const processNext = async (): Promise<void> => {
      while (nextIndex < candidates.length) {
        const candidate = candidates[nextIndex++];
        let outcome: 'sent' | 'skipped' | 'failed' = 'failed';
        try {
          const now = dependencies.now();
          const context = getReminderEligibilityContext(candidate.settings, now);
          if (!context.valid || !context.due) {
            outcome = 'skipped';
          } else {
            const recipient = getEligibleReminderRecipient(await dependencies.authLookup.getUser(candidate.uid));
            if (!recipient) {
              outcome = 'skipped';
            } else {
              const eligibility = await evaluateDailyReminderEligibility({
                uid: candidate.uid,
                settings: candidate.settings,
                now,
                hasJournalEntry: (uid, startUtcMs, endUtcMs) =>
                  dependencies.journalLookup.hasJournalEntryForUtcRange(uid, startUtcMs, endUtcMs),
              });
              if (!eligibility.eligible || !eligibility.localDate) {
                outcome = 'skipped';
              } else {
                const identity = { uid: candidate.uid, localDate: eligibility.localDate };
                const claim = await dependencies.deliveryStore.claimDailyReminderDelivery({
                  ...identity,
                  timeZone: candidate.settings.timeZone as string,
                  reminderTime: candidate.settings.time as string,
                });
                if (!claim.claimed) {
                  outcome = 'skipped';
                } else {
                  let providerAccepted = false;
                  try {
                    const message = dependencies.composeEmail({
                      to: recipient,
                      idempotencyKey: createDailyReminderIdempotencyKey(candidate.uid, eligibility.localDate),
                    });
                    await dependencies.emailTransport.send(message);
                    providerAccepted = true;
                  } catch (error) {
                    try {
                      await dependencies.deliveryStore.markDailyReminderFailed(identity, safeFailureCode(error));
                    } catch {
                      // Keep this user's failure isolated if persistence also fails.
                    }
                    outcome = 'failed';
                  }

                  // Once the provider has accepted the email, never make the claim
                  // retryable if persisting "sent" fails or has an uncertain result.
                  // Leaving it claimed favors at-most-once delivery until reconciliation.
                  if (providerAccepted) {
                    try {
                      outcome = await dependencies.deliveryStore.markDailyReminderSent(identity) ? 'sent' : 'failed';
                    } catch {
                      outcome = 'failed';
                    }
                  }
                }
              }
            }
          }
        } catch {
          outcome = 'failed';
        }
        result[outcome] += 1;
      }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, () => processNext()));
    return result;
  };
}

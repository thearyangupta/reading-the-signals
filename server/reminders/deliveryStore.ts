import { FieldValue } from 'firebase-admin/firestore';
import type { DocumentData, Firestore } from 'firebase-admin/firestore';

export type ReminderDeliveryStatus = 'claimed' | 'sent' | 'failed';

export interface ReminderDeliveryState {
  status: ReminderDeliveryStatus;
  attemptCount: number;
  lastErrorCode?: string;
  claimedAtMs?: number;
}

export interface ClaimDailyReminderDeliveryInput {
  uid: string;
  localDate: string;
  timeZone: string;
  reminderTime: string;
}

export interface ReminderDeliveryIdentity {
  uid: string;
  localDate: string;
}

export interface ClaimDailyReminderDeliveryResult {
  claimed: boolean;
  attemptCount: number;
}

interface StateTransitionResult {
  applied: boolean;
  state: ReminderDeliveryState | null;
}

const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REMINDER_TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const MAX_ERROR_CODE_LENGTH = 80;

// A process crash or forced redeploy between claiming and marking sent/failed
// would otherwise strand a user in "claimed" forever, since only "failed" is
// normally retryable. Treat a claim older than this as abandoned and safe to retry.
const STALE_CLAIM_TTL_MS = 15 * 60 * 1000;

function assertDeliveryIdentity({ uid, localDate }: ReminderDeliveryIdentity): void {
  if (!uid.trim() || uid.includes('/')) throw new Error('A valid reminder delivery uid is required.');
  if (!LOCAL_DATE_PATTERN.test(localDate)) throw new Error('Reminder delivery localDate must use YYYY-MM-DD.');
}

function deliveryDocumentPath({ uid, localDate }: ReminderDeliveryIdentity): string {
  assertDeliveryIdentity({ uid, localDate });
  return `users/${uid}/reminderDeliveries/${localDate}`;
}

function parseDeliveryState(data: DocumentData | undefined): ReminderDeliveryState | null {
  if (!data || !['claimed', 'sent', 'failed'].includes(data.status)) return null;

  const claimedAtMs = typeof data.claimedAt?.toMillis === 'function' ? data.claimedAt.toMillis() : undefined;

  return {
    status: data.status as ReminderDeliveryStatus,
    attemptCount: Number.isInteger(data.attemptCount) && data.attemptCount > 0 ? data.attemptCount : 1,
    ...(typeof data.lastErrorCode === 'string' ? { lastErrorCode: data.lastErrorCode } : {}),
    ...(typeof claimedAtMs === 'number' ? { claimedAtMs } : {}),
  };
}

export function sanitizeReminderDeliveryErrorCode(errorCode: string): string {
  const sanitized = errorCode
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_ERROR_CODE_LENGTH);
  return sanitized || 'UNKNOWN_ERROR';
}

function isStaleClaim(existing: ReminderDeliveryState, nowMs: number): boolean {
  return existing.status === 'claimed'
    && typeof existing.claimedAtMs === 'number'
    && nowMs - existing.claimedAtMs >= STALE_CLAIM_TTL_MS;
}

export function planDailyReminderClaim(
  existing: ReminderDeliveryState | null,
  nowMs: number
): ClaimDailyReminderDeliveryResult {
  if (!existing) return { claimed: true, attemptCount: 1 };
  if (existing.status === 'failed' || isStaleClaim(existing, nowMs)) {
    return { claimed: true, attemptCount: existing.attemptCount + 1 };
  }
  return { claimed: false, attemptCount: existing.attemptCount };
}

export function planDailyReminderSent(existing: ReminderDeliveryState | null): StateTransitionResult {
  if (!existing || existing.status !== 'claimed') return { applied: false, state: existing };
  return {
    applied: true,
    state: { status: 'sent', attemptCount: existing.attemptCount },
  };
}

export function planDailyReminderFailed(
  existing: ReminderDeliveryState | null,
  errorCode: string
): StateTransitionResult {
  if (!existing || existing.status !== 'claimed') return { applied: false, state: existing };
  return {
    applied: true,
    state: {
      status: 'failed',
      attemptCount: existing.attemptCount,
      lastErrorCode: sanitizeReminderDeliveryErrorCode(errorCode),
    },
  };
}

export function createReminderDeliveryStore(db: Firestore) {
  return {
    async claimDailyReminderDelivery(
      input: ClaimDailyReminderDeliveryInput
    ): Promise<ClaimDailyReminderDeliveryResult> {
      assertDeliveryIdentity(input);
      if (!input.timeZone.trim()) throw new Error('A reminder delivery timezone is required.');
      if (!REMINDER_TIME_PATTERN.test(input.reminderTime)) {
        throw new Error('Reminder delivery time must use HH:mm.');
      }

      const deliveryRef = db.doc(deliveryDocumentPath(input));
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(deliveryRef);
        const existing = snapshot.exists ? parseDeliveryState(snapshot.data()) : null;
        const claim = planDailyReminderClaim(existing, Date.now());
        if (!claim.claimed) return claim;

        const delivery = {
          localDate: input.localDate,
          timeZone: input.timeZone,
          reminderTime: input.reminderTime,
          status: 'claimed' as const,
          claimedAt: FieldValue.serverTimestamp(),
          attemptCount: claim.attemptCount,
        };

        if (snapshot.exists) {
          transaction.update(deliveryRef, {
            ...delivery,
            sentAt: FieldValue.delete(),
            lastErrorCode: FieldValue.delete(),
          });
        } else {
          transaction.create(deliveryRef, delivery);
        }
        return claim;
      });
    },

    async markDailyReminderSent(identity: ReminderDeliveryIdentity): Promise<boolean> {
      const deliveryRef = db.doc(deliveryDocumentPath(identity));
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(deliveryRef);
        const transition = planDailyReminderSent(parseDeliveryState(snapshot.data()));
        if (!transition.applied) return false;

        transaction.update(deliveryRef, {
          status: 'sent',
          sentAt: FieldValue.serverTimestamp(),
          lastErrorCode: FieldValue.delete(),
        });
        return true;
      });
    },

    async markDailyReminderFailed(
      identity: ReminderDeliveryIdentity,
      errorCode: string
    ): Promise<boolean> {
      const deliveryRef = db.doc(deliveryDocumentPath(identity));
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(deliveryRef);
        const transition = planDailyReminderFailed(parseDeliveryState(snapshot.data()), errorCode);
        if (!transition.applied || !transition.state?.lastErrorCode) return false;

        transaction.update(deliveryRef, {
          status: 'failed',
          lastErrorCode: transition.state.lastErrorCode,
        });
        return true;
      });
    },
  };
}

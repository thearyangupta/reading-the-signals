import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planDailyReminderClaim,
  planDailyReminderFailed,
  planDailyReminderSent,
} from './deliveryStore.ts';
import type { ReminderDeliveryState } from './deliveryStore.ts';

class FakeDeliveryStateStore {
  private readonly records = new Map<string, ReminderDeliveryState>();

  claim(uid: string, localDate: string, nowMs = 0): boolean {
    const key = `${uid}:${localDate}`;
    const claim = planDailyReminderClaim(this.records.get(key) ?? null, nowMs);
    if (claim.claimed) {
      this.records.set(key, { status: 'claimed', attemptCount: claim.attemptCount, claimedAtMs: nowMs });
    }
    return claim.claimed;
  }

  markSent(uid: string, localDate: string): boolean {
    const key = `${uid}:${localDate}`;
    const transition = planDailyReminderSent(this.records.get(key) ?? null);
    if (transition.applied && transition.state) this.records.set(key, transition.state);
    return transition.applied;
  }

  markFailed(uid: string, localDate: string, errorCode: string): boolean {
    const key = `${uid}:${localDate}`;
    const transition = planDailyReminderFailed(this.records.get(key) ?? null, errorCode);
    if (transition.applied && transition.state) this.records.set(key, transition.state);
    return transition.applied;
  }

  get(uid: string, localDate: string): ReminderDeliveryState | undefined {
    return this.records.get(`${uid}:${localDate}`);
  }
}

test('claims each user and local date at most once while active', () => {
  const store = new FakeDeliveryStateStore();
  assert.equal(store.claim('user-1', '2026-09-04'), true);
  assert.equal(store.claim('user-1', '2026-09-04'), false);
  assert.equal(store.claim('user-1', '2026-09-05'), true);
});

test('keeps an existing claimed delivery blocked until explicit reconciliation', () => {
  assert.deepEqual(planDailyReminderClaim({ status: 'claimed', attemptCount: 3, claimedAtMs: 1_000 }, 1_000), {
    claimed: false,
    attemptCount: 3,
  });
});

test('recovers a stale claimed delivery after the TTL, but not before it', () => {
  const claimedAtMs = 1_000;
  const justUnderTtl = claimedAtMs + 15 * 60 * 1000 - 1;
  const atTtl = claimedAtMs + 15 * 60 * 1000;

  assert.deepEqual(planDailyReminderClaim({ status: 'claimed', attemptCount: 1, claimedAtMs }, justUnderTtl), {
    claimed: false,
    attemptCount: 1,
  });
  assert.deepEqual(planDailyReminderClaim({ status: 'claimed', attemptCount: 1, claimedAtMs }, atTtl), {
    claimed: true,
    attemptCount: 2,
  });
});

test('never reclaims an already-sent delivery, even long after it was claimed', () => {
  const farFuture = 10_000 * 60 * 60 * 1000;
  assert.deepEqual(planDailyReminderClaim({ status: 'sent', attemptCount: 1, claimedAtMs: 0 }, farFuture), {
    claimed: false,
    attemptCount: 1,
  });
});

test('guards sent and failed transitions and sanitizes failure codes', () => {
  assert.equal(planDailyReminderSent(null).applied, false);
  assert.equal(planDailyReminderSent({ status: 'failed', attemptCount: 1 }).applied, false);
  assert.equal(planDailyReminderFailed({ status: 'sent', attemptCount: 1 }, 'should not apply').applied, false);
  assert.equal(
    planDailyReminderFailed({ status: 'claimed', attemptCount: 2 }, ' provider secret/value\nstack ').state?.lastErrorCode,
    'PROVIDER_SECRET_VALUE_STACK'
  );
});

test('sent delivery cannot be reclaimed', () => {
  const store = new FakeDeliveryStateStore();
  store.claim('user-1', '2026-09-04');
  assert.equal(store.markSent('user-1', '2026-09-04'), true);
  assert.deepEqual(store.get('user-1', '2026-09-04'), { status: 'sent', attemptCount: 1 });
  assert.equal(store.claim('user-1', '2026-09-04'), false);
});

test('failed delivery can be reclaimed and increments attempt count', () => {
  const store = new FakeDeliveryStateStore();
  store.claim('user-1', '2026-09-04');
  assert.equal(store.markFailed('user-1', '2026-09-04', 'provider timeout: 504'), true);
  assert.deepEqual(store.get('user-1', '2026-09-04'), {
    status: 'failed',
    attemptCount: 1,
    lastErrorCode: 'PROVIDER_TIMEOUT_504',
  });
  assert.equal(store.claim('user-1', '2026-09-04'), true);
  assert.deepEqual(store.get('user-1', '2026-09-04'), { status: 'claimed', attemptCount: 2, claimedAtMs: 0 });
});

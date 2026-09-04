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

  claim(uid: string, localDate: string): boolean {
    const key = `${uid}:${localDate}`;
    const claim = planDailyReminderClaim(this.records.get(key) ?? null);
    if (claim.claimed) {
      this.records.set(key, { status: 'claimed', attemptCount: claim.attemptCount });
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
  assert.deepEqual(store.get('user-1', '2026-09-04'), { status: 'claimed', attemptCount: 2 });
});

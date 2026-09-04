import type { Auth, UserRecord } from 'firebase-admin/auth';
import { isBasicEmailAddress } from '../email/types.ts';

export interface ReminderAuthUser {
  disabled: boolean;
  email?: string;
  emailVerified: boolean;
  providerData: Array<{ providerId: string }>;
}

export interface ReminderAuthLookup {
  getUser(uid: string): Promise<ReminderAuthUser | null>;
}

function toReminderAuthUser(user: UserRecord): ReminderAuthUser {
  return {
    disabled: user.disabled,
    email: user.email,
    emailVerified: user.emailVerified,
    providerData: user.providerData.map(({ providerId }) => ({ providerId })),
  };
}

export function createReminderAuthLookup(auth: Auth): ReminderAuthLookup {
  return {
    async getUser(uid: string): Promise<ReminderAuthUser | null> {
      try {
        return toReminderAuthUser(await auth.getUser(uid));
      } catch (error) {
        if ((error as { code?: string })?.code === 'auth/user-not-found') return null;
        throw error;
      }
    },
  };
}

export function getEligibleReminderRecipient(user: ReminderAuthUser | null): string | null {
  if (
    !user ||
    user.disabled ||
    !user.emailVerified ||
    !user.email ||
    !isBasicEmailAddress(user.email) ||
    user.providerData.length === 0
  ) {
    return null;
  }
  return user.email.trim();
}

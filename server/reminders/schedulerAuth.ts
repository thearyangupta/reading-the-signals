import { OAuth2Client } from 'google-auth-library';

export interface SchedulerOidcClaims {
  aud?: string;
  email?: string;
  email_verified?: boolean;
  iss?: string;
}

export interface SchedulerTokenVerifier {
  verify(token: string, audience: string): Promise<SchedulerOidcClaims>;
}

export interface SchedulerAuthenticationResult {
  authorized: boolean;
  status: 200 | 401 | 403 | 503;
}

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export function createGoogleSchedulerTokenVerifier(client = new OAuth2Client()): SchedulerTokenVerifier {
  return {
    async verify(token: string, audience: string): Promise<SchedulerOidcClaims> {
      const ticket = await client.verifyIdToken({ idToken: token, audience });
      const payload = ticket.getPayload();
      if (!payload) throw new Error('OIDC verification returned no payload.');
      return {
        aud: typeof payload.aud === 'string' ? payload.aud : undefined,
        email: payload.email,
        email_verified: payload.email_verified,
        iss: payload.iss,
      };
    },
  };
}

export async function authenticateSchedulerRequest(
  authorizationHeader: string | undefined,
  env: NodeJS.ProcessEnv,
  verifier: SchedulerTokenVerifier
): Promise<SchedulerAuthenticationResult> {
  const expectedEmail = env.REMINDER_SCHEDULER_SERVICE_ACCOUNT?.trim();
  const expectedAudience = env.REMINDER_SCHEDULER_AUDIENCE?.trim();
  if (!expectedEmail || !expectedAudience) return { authorized: false, status: 503 };
  if (!authorizationHeader?.startsWith('Bearer ')) return { authorized: false, status: 401 };

  const token = authorizationHeader.slice('Bearer '.length).trim();
  if (!token) return { authorized: false, status: 401 };

  let claims: SchedulerOidcClaims;
  try {
    claims = await verifier.verify(token, expectedAudience);
  } catch {
    return { authorized: false, status: 401 };
  }

  if (
    claims.aud !== expectedAudience ||
    !claims.iss ||
    !GOOGLE_ISSUERS.has(claims.iss) ||
    claims.email !== expectedEmail ||
    claims.email_verified !== true
  ) {
    return { authorized: false, status: 403 };
  }
  return { authorized: true, status: 200 };
}

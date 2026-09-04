import type { Request, RequestHandler, Response } from 'express';
import type { DailyReminderBatchResult } from './processDailyEmailReminders.ts';
import type { SchedulerAuthenticationResult } from './schedulerAuth.ts';

interface ScheduledReminderRouteDependencies {
  authenticate(authorizationHeader: string | undefined): Promise<SchedulerAuthenticationResult>;
  createProcessor(): () => Promise<DailyReminderBatchResult>;
}

export function createScheduledReminderHandler(dependencies: ScheduledReminderRouteDependencies): RequestHandler {
  return async (request: Request, response: Response) => {
    if (request.method !== 'POST') {
      response.status(405).json({ error: 'Method not allowed.' });
      return;
    }

    const auth = await dependencies.authenticate(request.header('authorization'));
    if (!auth.authorized) {
      response.status(auth.status).json({ error: auth.status === 503 ? 'Service unavailable.' : 'Unauthorized.' });
      return;
    }

    try {
      const result = await dependencies.createProcessor()();
      response.status(200).json(result);
    } catch {
      response.status(503).json({ error: 'Service unavailable.' });
    }
  };
}

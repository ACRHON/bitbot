/**
 * Robot Status Handler
 */

import { Env } from '../db/queries';

export async function handleRobotStatus(env: Env): Promise<Response> {
  // Get the most recent cron job run time
  const stmt = env.DB.prepare(
    'SELECT last_run_at FROM cron_jobs WHERE last_run_at IS NOT NULL ORDER BY last_run_at DESC LIMIT 1'
  );
  const result = await stmt.first();

  const lastRunAt = result?.last_run_at || 0;
  const now = Date.now();

  // Online if a cron job ran within the last 10 minutes
  const online = lastRunAt > 0 && (now - lastRunAt) < 10 * 60 * 1000;

  const status = {
    online,
    lastActivity: lastRunAt,
    version: '1.0.0',
    env: (env as any).ENV || 'production',
  };

  return new Response(JSON.stringify(status), {
    headers: { 'Content-Type': 'application/json' },
  });
}
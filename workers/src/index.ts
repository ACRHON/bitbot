/**
 * bitbot Cloudflare Workers Entry Point
 */

export interface Env {
  DB: D1Database;
  BITBOT_KV: KVNamespace;
  ENV: string;
  ASSETS: { fetch: typeof fetch };
}

import { handleFeishuWebhook } from './routes/feishu';
import { handleAttendanceRequest } from './routes/attendance';
import { handleInstitutionRequest } from './routes/institutions';
import { handleAuthRequest } from './routes/auth';
import { handleCronTrigger } from './routes/cron';
import { handleAdminAuthRequest } from './routes/admin-auth';
import { handleAdminCronRequest } from './routes/admin-cron';
import { handleAdminActivationRequest } from './routes/admin-activation';
import { handleAdminAttendanceRequest } from './routes/admin-attendance';
import { handleRobotStatus } from './routes/robot';
import { handleCampusRequest } from './routes/campus';
import { getStats, getAdminUserById } from './db/queries';

declare module '@cloudflare/workers-types' {
  interface Env {
    DB: D1Database;
    BITBOT_KV: KVNamespace;
    ENV: string;
    ASSETS: { fetch: typeof fetch };
  }
}

/**
 * Main request handler - Cloudflare Workers fetch signature
 */
async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-feishu-app-id',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // API routes
    if (url.pathname.startsWith('/api/')) {
      let response: Response;

      // Admin auth routes (login, register, me)
      if (url.pathname === '/api/admin/login' || url.pathname === '/api/admin/register' || url.pathname === '/api/admin/me') {
        response = await handleAdminAuthRequest(env, request);
      } else if (url.pathname === '/api/admin/stats') {
        // Stats
        response = await handleAdminStats(request, env);
      } else if (url.pathname.startsWith('/api/admin/cron')) {
        // Admin cron management
        response = await handleAdminCronRequest(env, request);
      } else if (url.pathname.startsWith('/api/admin/activation')) {
        // Admin activation code management
        response = await handleAdminActivationRequest(env, request);
      } else if (url.pathname.startsWith('/api/admin/attendance') || url.pathname.startsWith('/api/admin/students')) {
        // Admin attendance records and students
        response = await handleAdminAttendanceRequest(env, request);
      } else if (url.pathname.startsWith('/api/admin/')) {
        // Admin institution management
        response = await handleInstitutionRequest(env, request);
      } else if (url.pathname.startsWith('/api/auth/')) {
        response = await handleAuthRequest(env, request);
      } else if (url.pathname.startsWith('/api/attendance/')) {
        response = await handleAttendanceRequest(env, request);
      } else if (url.pathname === '/api/attendance') {
        response = await handleAttendanceRequest(env, request);
      } else if (url.pathname === '/api/robot/status') {
        response = await handleRobotStatus(env);
      } else if (url.pathname.startsWith('/api/campus/')) {
        response = await handleCampusRequest(env, request);
      } else {
        response = new Response('Not Found', { status: 404 });
      }

      // Add CORS headers to API responses
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // Feishu webhook
    if (url.pathname.startsWith('/webhook/')) {
      const response = await handleFeishuWebhook(env, request);
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        newHeaders.set(key, value);
      });
      return new Response(response.body, {
        status: response.status,
        headers: newHeaders,
      });
    }

    // Serve static frontend from assets
    if (env.ASSETS) {
      const assets = await env.ASSETS.fetch(request);
      if (assets.status === 200 || assets.status === 404) {
        return assets;
      }
    }
    return new Response('bitbot API server running', { status: 200 });
  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(`Internal Error: ${error}`, { status: 500 });
  }
}

/**
 * Cron trigger handler
 * This is called by Cloudflare Cron based on wrangler.toml configuration
 */
async function handleScheduled(event: ScheduledEvent): Promise<void> {
  const env = (event as any).env as Env;
  await handleCronTrigger(env);
}

// Export for Cloudflare Workers
export default {
  fetch: handleRequest,
  scheduled: handleScheduled,
};

// Stats handler
async function handleAdminStats(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '未登录，请先登录' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');
    const user = await getAdminUserById(env, userId);

    if (!user) {
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const stats = await getStats(env);
    return new Response(JSON.stringify(stats), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

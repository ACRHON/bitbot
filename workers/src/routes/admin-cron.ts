/**
 * Admin Cron Job Handler
 */

import { Env, listCronJobs, getInstitutionById, createCronJob, updateCronJob, deleteCronJob, getAdminUserById, getCronJob, getEnabledCronJobs } from '../db/queries';
import { handleCronTrigger, executeCronJobById } from './cron';

export async function handleAdminCronRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Auth check
  const authError = await checkAuth(request, env);
  if (authError) return authError;

  // Route: GET /api/admin/cron
  if (request.method === 'GET' && path === '/api/admin/cron') {
    return await list(env);
  }

  // Route: GET /api/admin/cron/:id
  if (request.method === 'GET' && path.startsWith('/api/admin/cron/')) {
    const id = path.split('/')[4];
    return await get(env, id);
  }

  // Route: POST /api/admin/cron
  if (request.method === 'POST' && path === '/api/admin/cron') {
    return await create(env, request);
  }

  // Route: PUT /api/admin/cron/:id
  if (request.method === 'PUT' && path.startsWith('/api/admin/cron/')) {
    const id = path.split('/')[4];
    return await update(env, id, request);
  }

  // Route: POST /api/admin/cron/:id/trigger
  if (request.method === 'POST' && path.match(/^\/api\/admin\/cron\/[^/]+\/trigger$/)) {
    const id = path.split('/')[4];
    return await trigger(env, id);
  }

  // Route: DELETE /api/admin/cron/:id
  if (request.method === 'DELETE' && path.startsWith('/api/admin/cron/')) {
    const id = path.split('/')[4];
    return await remove(env, id);
  }

  return new Response('Not Found', { status: 404 });
}

async function checkAuth(request: Request, env: Env): Promise<Response | null> {
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
  } catch (error) {
    return new Response(JSON.stringify({ error: '验证失败' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return null;
}

async function list(env: Env): Promise<Response> {
  const jobs = await listCronJobs(env);

  // Enrich with institution names
  const enrichedJobs = await Promise.all(
    jobs.map(async (job) => {
      const institution = await getInstitutionById(env, job.institution_id);
      return {
        ...job,
        institution_name: institution?.name || 'Unknown',
      };
    })
  );

  return new Response(JSON.stringify(enrichedJobs), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function get(env: Env, id: string): Promise<Response> {
  const jobs = await listCronJobs(env);
  const job = jobs.find(j => j.id === id);

  if (!job) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(JSON.stringify(job), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function update(env: Env, id: string, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    await updateCronJob(env, id, body);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function create(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { institution_id, job_type, schedule, enabled, config } = body;

    if (!institution_id || !job_type || !schedule) {
      return new Response(JSON.stringify({ error: '缺少必填字段' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    await createCronJob(env, {
      id,
      institution_id,
      job_type,
      schedule,
      enabled: enabled ? 1 : 0,
      config: config || null,
    });

    return new Response(JSON.stringify({ id, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create cron job error:', error);
    return new Response(JSON.stringify({ error: '创建失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function remove(env: Env, id: string): Promise<Response> {
  try {
    await deleteCronJob(env, id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function trigger(env: Env, id: string): Promise<Response> {
  try {
    const job = await getCronJob(env, id);
    if (!job) {
      return new Response('Cron job not found', { status: 404 });
    }

    // Execute the specific cron job directly
    await executeCronJobById(env, id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Cron job triggered successfully'
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Trigger cron job error:', error);
    return new Response(JSON.stringify({ error: '触发失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

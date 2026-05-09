/**
 * Institution Management Handler
 * Admin CRUD for institutions
 */

import { Env, getAdminUserById } from '../db/queries';

export async function handleInstitutionRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Auth check
  const authError = await checkAuth(request, env);
  if (authError) return authError;

  // Route: GET /api/admin/institutions
  if (request.method === 'GET' && path === '/api/admin/institutions') {
    return await list(env);
  }

  // Route: GET /api/admin/institutions/:id
  if (request.method === 'GET' && path.startsWith('/api/admin/institutions/')) {
    const id = path.split('/')[4];
    return await get(env, id);
  }

  // Route: POST /api/admin/institutions
  if (request.method === 'POST' && path === '/api/admin/institutions') {
    return await create(env, request);
  }

  // Route: PUT /api/admin/institutions/:id
  if (request.method === 'PUT' && path.startsWith('/api/admin/institutions/')) {
    const id = path.split('/')[4];
    return await update(env, id, request);
  }

  // Route: DELETE /api/admin/institutions/:id
  if (request.method === 'DELETE' && path.startsWith('/api/admin/institutions/')) {
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
  const { listInstitutions } = await import('../db/queries');
  const institutions = await listInstitutions(env);
  return new Response(JSON.stringify(institutions), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function get(env: Env, id: string): Promise<Response> {
  const { getInstitutionById } = await import('../db/queries');
  const institution = await getInstitutionById(env, id);
  if (!institution) {
    return new Response('Institution not found', { status: 404 });
  }
  return new Response(JSON.stringify(institution), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function create(env: Env, request: Request): Promise<Response> {
  try {
    const { listInstitutions, createInstitution, getInstitutionById, getActivationCodeByCode, useActivationCode } = await import('../db/queries');

    const body = await request.json();
    const {
      name,
      feishu_app_id,
      feishu_app_secret,
      feishu_verification_token,
      feishu_encrypt_key,
      bitable_base_id,
      activation_code,
    } = body;

    if (!name || !feishu_app_id || !feishu_app_secret) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Check if app_id already exists
    const existing = await listInstitutions(env);
    if (existing.some(i => i.feishu_app_id === feishu_app_id)) {
      return new Response('Institution with this app_id already exists', { status: 409 });
    }

    // Process activation code if provided
    let expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // Default 1 year
    if (activation_code) {
      const code = await getActivationCodeByCode(env, activation_code);
      if (!code) {
        return new Response(JSON.stringify({ error: '激活码无效' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (code.used) {
        return new Response(JSON.stringify({ error: '激活码已被使用' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (code.expires_at < Date.now()) {
        return new Response(JSON.stringify({ error: '激活码已过期' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      expiresAt = code.expires_at;
    }

    const id = crypto.randomUUID();
    await createInstitution(env, {
      id,
      name,
      feishu_app_id,
      feishu_app_secret,
      feishu_verification_token: feishu_verification_token || null,
      feishu_encrypt_key: feishu_encrypt_key || null,
      bitable_base_id: bitable_base_id || null,
      expires_at: expiresAt,
      status: 'active',
      activation_code: activation_code || null,
    });

    // Mark activation code as used
    if (activation_code) {
      const code = await getActivationCodeByCode(env, activation_code);
      if (code) {
        await useActivationCode(env, code.id, id);
      }
    }

    const institution = await getInstitutionById(env, id);
    return new Response(JSON.stringify(institution), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Create institution error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function update(env: Env, id: string, request: Request): Promise<Response> {
  try {
    const { updateInstitution, getInstitutionById, getActivationCodeByCode, useActivationCode } = await import('../db/queries');

    const body = await request.json();

    // Don't allow updating feishu_app_id
    delete body.feishu_app_id;
    // Don't allow updating feishu_app_secret if empty
    if (!body.feishu_app_secret) delete body.feishu_app_secret;

    // Handle activation code for renewal
    if (body.activation_code) {
      const code = await getActivationCodeByCode(env, body.activation_code);
      if (!code) {
        return new Response(JSON.stringify({ error: '激活码无效' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (code.used) {
        return new Response(JSON.stringify({ error: '激活码已被使用' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (code.expires_at < Date.now()) {
        return new Response(JSON.stringify({ error: '激活码已过期' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      // Extend expiration to match activation code
      body.expires_at = code.expires_at;
      await useActivationCode(env, code.id, id);
    }

    await updateInstitution(env, id, body);

    const institution = await getInstitutionById(env, id);
    return new Response(JSON.stringify(institution), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function remove(env: Env, id: string): Promise<Response> {
  try {
    const { deleteInstitution } = await import('../db/queries');
    await deleteInstitution(env, id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

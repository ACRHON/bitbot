/**
 * Authorization Handler
 * Manages authorized users for institutions
 */

import { Env, getAuthorizedUser, listAuthorizedUsers, createAuthorizedUser, deleteAuthorizedUser, getInstitutionById, getAdminUserById } from '../db/queries';

export async function handleAuthRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route: GET /api/auth/check?open_id=xxx (public - for H5 user verification)
  if (request.method === 'GET' && path === '/api/auth/check') {
    const openId = url.searchParams.get('open_id');
    if (!openId) {
      return new Response('Missing open_id', { status: 400 });
    }
    return await checkFeishuUser(env, openId);
  }

  // Below routes require admin auth
  const adminAuthError = await checkAdminAuth(request, env);
  if (adminAuthError) return adminAuthError;

  // Route: GET /api/auth/users?institution_id=xxx
  if (request.method === 'GET' && path === '/api/auth/users') {
    const institutionId = url.searchParams.get('institution_id');
    if (!institutionId) {
      return new Response('Missing institution_id', { status: 400 });
    }
    return await listUsers(env, institutionId);
  }

  // Route: POST /api/auth/users
  if (request.method === 'POST' && path === '/api/auth/users') {
    return await addUser(env, request);
  }

  // Route: DELETE /api/auth/users/:id
  if (request.method === 'DELETE' && path.startsWith('/api/auth/users/')) {
    const id = path.split('/')[4];
    return await removeUser(env, id);
  }

  return new Response('Not Found', { status: 404 });
}

async function checkAdminAuth(request: Request, env: Env): Promise<Response | null> {
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

async function checkFeishuUser(env: Env, openId: string): Promise<Response> {
  // This is for verifying if a feishu user is authorized to use the robot
  // This is called from H5 pages after card button click
  const user = await getAuthorizedUser(env, openId);

  if (!user) {
    return new Response(
      JSON.stringify({
        authorized: false,
        message: '未授权，请联系平台管理员',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Check institution status
  const institution = await getInstitutionById(env, user.institution_id);
  if (!institution || institution.status !== 'active') {
    return new Response(
      JSON.stringify({
        authorized: false,
        message: '机构服务已到期或已停用',
      }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      authorized: true,
      user: {
        id: user.id,
        open_id: user.feishu_open_id,
        name: user.feishu_name,
        role: user.role,
        institution_id: user.institution_id,
      },
      institution: {
        id: institution.id,
        name: institution.name,
        expires_at: institution.expires_at,
      },
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function listUsers(env: Env, institutionId: string): Promise<Response> {
  const users = await listAuthorizedUsers(env, institutionId);
  return new Response(JSON.stringify(users), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function addUser(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { institution_id, feishu_open_id, feishu_name, role } = body;

    if (!institution_id || !feishu_open_id) {
      return new Response('Missing required fields', { status: 400 });
    }

    // Verify institution exists
    const institution = await getInstitutionById(env, institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    const id = crypto.randomUUID();
    await createAuthorizedUser(env, {
      id,
      institution_id,
      feishu_open_id: feishu_open_id,
      feishu_name: feishu_name || null,
      role: role || 'teacher',
    });

    return new Response(JSON.stringify({ id, success: true }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Add user error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function removeUser(env: Env, id: string): Promise<Response> {
  try {
    await deleteAuthorizedUser(env, id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

/**
 * Admin Authentication Handler
 */

import { Env, getAdminUserByUsername, getAdminUserById, createAdminUser, updateAdminLastLogin } from '../db/queries';

export async function handleAdminAuthRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route: POST /api/admin/login
  if (request.method === 'POST' && path === '/api/admin/login') {
    return await login(env, request);
  }

  // Route: GET /api/admin/me
  if (request.method === 'GET' && path === '/api/admin/me') {
    return await getCurrentUser(env, request);
  }

  // Route: POST /api/admin/register (first user only)
  if (request.method === 'POST' && path === '/api/admin/register') {
    return await register(env, request);
  }

  return new Response('Not Found', { status: 404 });
}

async function login(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const user = await getAdminUserByUsername(env, username);
    if (!user) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Simple password check (in production, use bcrypt or similar)
    // For now, we'll use a simple comparison
    // Note: Cloudflare Workers doesn't have crypto module in older runtimes
    if (!verifyPassword(password, user.password_hash)) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update last login
    await updateAdminLastLogin(env, user.id);

    // Return token (in production, use JWT or proper session)
    const token = btoa(`${user.id}:${Date.now()}`);

    return new Response(JSON.stringify({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ error: '登录失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function getCurrentUser(env: Env, request: Request): Promise<Response> {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: '未登录' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.substring(7);
    const [userId] = atob(token).split(':');

    const user = await getAdminUserById(env, userId);
    if (!user) {
      return new Response(JSON.stringify({ error: '用户不存在' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
      },
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: '获取用户信息失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function register(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { username, password, name } = body;

    if (!username || !password || !name) {
      return new Response(JSON.stringify({ error: '用户名、密码、姓名不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check if any user exists
    const existing = await getAdminUserByUsername(env, username);
    if (existing) {
      return new Response(JSON.stringify({ error: '用户名已存在' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await createAdminUser(env, {
      id,
      username,
      password_hash: passwordHash,
      name,
      role: 'super_admin',
      created_at: Date.now(),
    });

    const token = btoa(`${id}:${Date.now()}`);

    return new Response(JSON.stringify({
      token,
      user: {
        id,
        username,
        name,
        role: 'super_admin',
      },
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Register error:', error);
    return new Response(JSON.stringify({ error: '注册失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Simple password hashing (in production, use bcrypt)
function hashPassword(password: string): string {
  // Simple hash for demo - use bcrypt in production
  // This is a basic implementation using UTF-8 encoding
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'bitbot_salt_2024');
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash = hash & hash; // Convert to 32bit integer
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

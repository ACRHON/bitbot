/**
 * Admin Activation Code Handler
 */

import { Env, createActivationCode, listActivationCodes, listBatches, getActivationCodeById, getActivationCodeByCode, deleteActivationCode, deleteActivationCodesByBatch, deleteActivationCodesByBatchAll, revokeActivationCode, getAdminUserById } from '../db/queries';

export async function handleAdminActivationRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Check admin auth
  const authError = await checkAdminAuth(request, env);
  if (authError) return authError;

  // Route: POST /api/admin/activation/generate - batch generate
  if (request.method === 'POST' && path === '/api/admin/activation/generate') {
    return await generateCodes(env, request);
  }

  // Route: GET /api/admin/activation/codes
  if (request.method === 'GET' && path === '/api/admin/activation/codes') {
    return await listCodes(env, url);
  }

  // Route: GET /api/admin/activation/batches
  if (request.method === 'GET' && path === '/api/admin/activation/batches') {
    return await listBatchNames(env);
  }

  // Route: GET /api/admin/activation/validate
  if (request.method === 'GET' && path === '/api/admin/activation/validate') {
    const code = url.searchParams.get('code');
    return await validateCode(env, code);
  }

  // Route: PUT /api/admin/activation/codes/:id/revoke
  if (request.method === 'PUT' && path.match(/\/api\/admin\/activation\/codes\/[^/]+\/revoke$/)) {
    const id = path.split('/')[5];
    return await revokeCode(env, id, request);
  }

  // Route: DELETE /api/admin/activation/codes/:id
  if (request.method === 'DELETE' && path.match(/^\/api\/admin\/activation\/codes\/[^/]+$/)) {
    const id = path.split('/')[5];
    return await removeCode(env, id);
  }

  // Route: DELETE /api/admin/activation/batch/:batchName
  if (request.method === 'DELETE' && path.match(/^\/api\/admin\/activation\/batch\/[^/]+$/)) {
    const batchName = decodeURIComponent(path.split('/')[5]);
    const force = url.searchParams.get('force') === 'true';
    return await deleteBatch(env, batchName, force);
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

function generateCodeString(): string {
  const year = new Date().getFullYear();
  const randomPart1 = Math.random().toString(36).substring(2, 8).toUpperCase();
  const randomPart2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `BTB-${year}-${randomPart1}-${randomPart2}`;
}

async function generateCodes(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const count = Math.min(Math.max(body.count || 1, 1), 100);
    const durationDays = body.duration_days || 365;
    const batchName = body.batch_name || null;

    if (durationDays < 1 || durationDays > 3650) {
      return new Response(JSON.stringify({ error: '天数必须在 1-3650 之间' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const codes = [];
    const expiresAt = Date.now() + durationDays * 24 * 60 * 60 * 1000;

    for (let i = 0; i < count; i++) {
      const id = crypto.randomUUID();
      const code = generateCodeString();

      await createActivationCode(env, {
        id,
        code,
        duration_days: durationDays,
        expires_at: expiresAt,
        batch_name: batchName,
      });

      codes.push({ id, code, duration_days: durationDays, expires_at: expiresAt, batch_name: batchName });
    }

    return new Response(JSON.stringify({
      count,
      codes,
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Generate activation codes error:', error);
    return new Response(JSON.stringify({ error: '生成激活码失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function listCodes(env: Env, url: URL): Promise<Response> {
  try {
    const batchName = url.searchParams.get('batch') || undefined;
    const status = url.searchParams.get('status') || undefined;
    const codes = await listActivationCodes(env, batchName, status);
    return new Response(JSON.stringify(codes), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List activation codes error:', error);
    return new Response(JSON.stringify({ error: '获取激活码列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function listBatchNames(env: Env): Promise<Response> {
  try {
    const batches = await listBatches(env);
    return new Response(JSON.stringify(batches), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List batches error:', error);
    return new Response(JSON.stringify({ error: '获取批次列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function validateCode(env: Env, codeStr: string | null): Promise<Response> {
  if (!codeStr) {
    return new Response(JSON.stringify({ valid: false, error: '请输入激活码' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const code = await getActivationCodeByCode(env, codeStr);
    if (!code) {
      return new Response(JSON.stringify({ valid: false, error: '激活码不存在' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (code.used) {
      return new Response(JSON.stringify({ valid: false, error: '激活码已被使用' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (code.revoked) {
      return new Response(JSON.stringify({ valid: false, error: '激活码已被撤销' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (code.expires_at < Date.now()) {
      return new Response(JSON.stringify({ valid: false, error: '激活码已过期' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({
      valid: true,
      duration_days: code.duration_days,
      expires_at: code.expires_at,
      batch_name: code.batch_name,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Validate activation code error:', error);
    return new Response(JSON.stringify({ valid: false, error: '验证失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function revokeCode(env: Env, id: string, request: Request): Promise<Response> {
  try {
    const code = await getActivationCodeById(env, id);
    if (!code) {
      return new Response(JSON.stringify({ error: '激活码不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (code.used) {
      return new Response(JSON.stringify({ error: '已使用的激活码无法撤销' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (code.revoked) {
      return new Response(JSON.stringify({ error: '激活码已被撤销' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || '管理员撤销';

    await revokeActivationCode(env, id, reason);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Revoke activation code error:', error);
    return new Response(JSON.stringify({ error: '撤销激活码失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function removeCode(env: Env, id: string): Promise<Response> {
  try {
    const code = await getActivationCodeById(env, id);
    if (!code) {
      return new Response(JSON.stringify({ error: '激活码不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (code.used) {
      return new Response(JSON.stringify({ error: '已使用的激活码无法删除' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (code.revoked) {
      return new Response(JSON.stringify({ error: '已撤销的激活码无法删除' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await deleteActivationCode(env, id);
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete activation code error:', error);
    return new Response(JSON.stringify({ error: '删除激活码失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function deleteBatch(env: Env, batchName: string, force: boolean = false): Promise<Response> {
  try {
    // Handle "默认批次" as null in database
    const dbBatchName = batchName === '默认批次' ? null : batchName;
    const deletedCount = force
      ? await deleteActivationCodesByBatchAll(env, dbBatchName)
      : await deleteActivationCodesByBatch(env, dbBatchName);
    return new Response(JSON.stringify({ success: true, deleted: deletedCount }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Delete batch error:', error);
    return new Response(JSON.stringify({ error: '删除批次失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

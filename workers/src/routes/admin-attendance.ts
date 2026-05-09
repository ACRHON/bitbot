/**
 * Admin Attendance Handler
 * Handles attendance records and student management
 */

import { Env, listInstitutions, getInstitutionById, getAdminUserById } from '../db/queries';
import * as bitable from '../services/bitable';

export async function handleAdminAttendanceRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Auth check
  const authError = await checkAuth(request, env);
  if (authError) return authError;

  // Route: GET /api/admin/attendance/records
  if (request.method === 'GET' && path === '/api/admin/attendance/records') {
    const institutionId = url.searchParams.get('institution_id') || '';
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const status = url.searchParams.get('status');
    const keyword = url.searchParams.get('keyword');
    return await listRecords(env, institutionId, { dateFrom, dateTo, status, keyword });
  }

  // Route: GET /api/admin/students
  if (request.method === 'GET' && path === '/api/admin/students') {
    const institutionId = url.searchParams.get('institution_id') || '';
    const keyword = url.searchParams.get('keyword');
    return await listStudents(env, institutionId, keyword || '');
  }

  // Route: GET /api/admin/institutions/:id/stats
  if (request.method === 'GET' && path.match(/\/api\/admin\/institutions\/[^/]+\/stats$/)) {
    const id = path.split('/')[4];
    return await getInstitutionStats(env, id);
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

async function listRecords(
  env: Env,
  institutionId: string,
  filters: { dateFrom?: string | null; dateTo?: string | null; status?: string | null; keyword?: string | null }
): Promise<Response> {
  try {
    let institutions: any[];

    if (institutionId) {
      const inst = await getInstitutionById(env, institutionId);
      institutions = inst ? [inst] : [];
    } else {
      institutions = await listInstitutions(env);
    }

    const allRecords: any[] = [];

    for (const inst of institutions) {
      if (!inst.bitable_base_id || !inst.bitable_sign_record_table_id) continue;

      const bitableConfig = {
        appId: inst.feishu_app_id,
        appSecret: inst.feishu_app_secret,
        baseId: inst.bitable_base_id,
      };

      try {
        const records = await bitable.getRecords(bitableConfig, inst.bitable_sign_record_table_id);

        for (const record of records) {
          const fields = record.fields || {};

          // Apply filters
          if (filters.status && fields['签到情况'] !== filters.status) continue;

          if (filters.dateFrom) {
            const recordTime = fields['上课时间'];
            if (recordTime && recordTime < parseInt(filters.dateFrom)) continue;
          }

          if (filters.dateTo) {
            const recordTime = fields['上课时间'];
            if (recordTime && recordTime > parseInt(filters.dateTo)) continue;
          }

          if (filters.keyword) {
            const name = fields['姓名'] || '';
            if (!name.toLowerCase().includes(filters.keyword.toLowerCase())) continue;
          }

          allRecords.push({
            record_id: record.record_id,
            institution_id: inst.id,
            institution_name: inst.name,
            student_name: fields['姓名'] || '',
            course_name: fields['课程'] || '',
            class_name: fields['班级'] || '',
            scheduled_time: fields['上课时间'] || null,
            sign_status: fields['签到情况'] || '待签到',
            sign_method: fields['签到方式'] || '',
          });
        }
      } catch (e) {
        console.error(`Failed to fetch records for institution ${inst.id}:`, e);
      }
    }

    // Sort by scheduled_time descending
    allRecords.sort((a, b) => (b.scheduled_time || 0) - (a.scheduled_time || 0));

    return new Response(JSON.stringify({ records: allRecords }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List attendance records error:', error);
    return new Response(JSON.stringify({ error: '获取考勤记录失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function listStudents(
  env: Env,
  institutionId: string,
  keyword: string
): Promise<Response> {
  try {
    let institutions: any[];

    if (institutionId) {
      const inst = await getInstitutionById(env, institutionId);
      institutions = inst ? [inst] : [];
    } else {
      institutions = await listInstitutions(env);
    }

    const allStudents: any[] = [];

    for (const inst of institutions) {
      if (!inst.bitable_base_id || !inst.bitable_student_table_id) continue;

      const bitableConfig = {
        appId: inst.feishu_app_id,
        appSecret: inst.feishu_app_secret,
        baseId: inst.bitable_base_id,
      };

      try {
        const records = await bitable.getStudents(bitableConfig, inst.bitable_student_table_id);

        for (const record of records) {
          if (keyword && !record.name.toLowerCase().includes(keyword.toLowerCase())) continue;

          allStudents.push({
            record_id: record.record_id,
            institution_id: inst.id,
            institution_name: inst.name,
            name: record.name || '',
            phone: record.fields?.['电话'] || '',
            parent_phone: record.fields?.['家长电话'] || '',
            class_name: record.fields?.['所属班级'] || '',
            created_at: record.fields?.['创建时间'] || null,
          });
        }
      } catch (e) {
        console.error(`Failed to fetch students for institution ${inst.id}:`, e);
      }
    }

    // Sort by name
    allStudents.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ students: allStudents }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('List students error:', error);
    return new Response(JSON.stringify({ error: '获取学员列表失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function getInstitutionStats(env: Env, institutionId: string): Promise<Response> {
  try {
    const inst = await getInstitutionById(env, institutionId);
    if (!inst) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!inst.bitable_base_id || !inst.bitable_sign_record_table_id) {
      return new Response(JSON.stringify({
        stats: {
          total: 0,
          signIn: 0,
          leave: 0,
          absent: 0,
          pending: 0,
        }
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bitableConfig = {
      appId: inst.feishu_app_id,
      appSecret: inst.feishu_app_secret,
      baseId: inst.bitable_base_id,
    };

    const records = await bitable.getRecords(bitableConfig, inst.bitable_sign_record_table_id);

    let signIn = 0, leave = 0, absent = 0, pending = 0;

    for (const record of records) {
      const status = record.fields?.['签到情况'] || '待签到';
      switch (status) {
        case '已到': signIn++; break;
        case '请假': leave++; break;
        case '缺勤': absent++; break;
        default: pending++;
      }
    }

    return new Response(JSON.stringify({
      stats: {
        total: records.length,
        signIn,
        leave,
        absent,
        pending,
      }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get institution stats error:', error);
    return new Response(JSON.stringify({ error: '获取统计数据失败' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

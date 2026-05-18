/**
 * Attendance Session Handler
 * Manages attendance sessions and student attendance operations
 */

import { Env } from '../db/queries';
import {
  getAttendanceSession,
  updateAttendanceSession,
  listAttendanceSessions,
  createAttendanceSession,
  getInstitutionById,
  createAttendanceLog,
  listAttendanceLogs,
} from '../db/queries';
import { FeishuConfig } from '../services/feishu-api';
import * as bitable from '../services/bitable';

export async function handleAttendanceRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Route: GET /api/attendance/:id
  if (request.method === 'GET' && path.startsWith('/api/attendance/')) {
    const id = path.split('/')[3];
    return await getSession(env, id);
  }

  // Route: GET /api/attendance (list)
  if (request.method === 'GET' && path === '/api/attendance') {
    const institutionId = url.searchParams.get('institution_id');
    const status = url.searchParams.get('status') || undefined;
    if (!institutionId) {
      return new Response('Missing institution_id', { status: 400 });
    }
    return await listSessions(env, institutionId, status);
  }

  // Route: POST /api/attendance
  if (request.method === 'POST' && path === '/api/attendance') {
    return await createSession(env, request);
  }

  // Route: PUT /api/attendance/:id
  if (request.method === 'PUT' && path.startsWith('/api/attendance/')) {
    const id = path.split('/')[3];
    return await updateSession(env, id, request);
  }

  // Route: POST /api/attendance/:id/sign
  if (request.method === 'POST' && path.match(/\/api\/attendance\/[^/]+\/sign$/)) {
    const id = path.split('/')[3];
    return await signStudent(env, id, request);
  }

  // Route: GET /api/attendance/:id/students
  if (request.method === 'GET' && path.match(/\/api\/attendance\/[^/]+\/students$/)) {
    const id = path.split('/')[3];
    return await getSessionStudents(env, id);
  }

  // Route: GET /api/attendance/:id/absences
  if (request.method === 'GET' && path.match(/\/api\/attendance\/[^/]+\/absences$/)) {
    const id = path.split('/')[3];
    return await getSessionAbsences(env, id);
  }

  // Route: POST /api/attendance/:id/makeup
  if (request.method === 'POST' && path.match(/\/api\/attendance\/[^/]+\/makeup$/)) {
    const id = path.split('/')[3];
    return await makeupSign(env, id, request);
  }

  // Route: GET /api/attendance/:id/search-students
  if (request.method === 'GET' && path.match(/\/api\/attendance\/[^/]+\/search-students$/)) {
    const id = path.split('/')[3];
    const keyword = url.searchParams.get('keyword') || '';
    return await searchStudents(env, id, keyword);
  }

  // Route: POST /api/attendance/:id/add-temp-student
  if (request.method === 'POST' && path.match(/\/api\/attendance\/[^/]+\/add-temp-student$/)) {
    const id = path.split('/')[3];
    return await addTempStudent(env, id, request);
  }

  // Route: POST /api/attendance/:id/undo
  if (request.method === 'POST' && path.match(/\/api\/attendance\/[^/]+\/undo$/)) {
    const id = path.split('/')[3];
    return await undoSign(env, id, request);
  }

  // Route: GET /api/attendance/:id/logs
  if (request.method === 'GET' && path.match(/\/api\/attendance\/[^/]+\/logs$/)) {
    const id = path.split('/')[3];
    return await getLogs(env, id);
  }

  // Route: POST /api/attendance/:id/end
  if (request.method === 'POST' && path.match(/\/api\/attendance\/[^/]+\/end$/)) {
    const id = path.split('/')[3];
    return await endSession(env, id, request);
  }

  return new Response('Not Found', { status: 404 });
}

async function getSession(env: Env, id: string): Promise<Response> {
  const session = await getAttendanceSession(env, id);
  if (!session) {
    return new Response('Session not found', { status: 404 });
  }

  return new Response(JSON.stringify(session), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function listSessions(
  env: Env,
  institutionId: string,
  status?: string
): Promise<Response> {
  const sessions = await listAttendanceSessions(env, institutionId, status);
  return new Response(JSON.stringify(sessions), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function createSession(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const {
      institution_id,
      record_id,
      course_name,
      class_name,
      teacher_name,
      scheduled_time,
    } = body;

    if (!institution_id || !record_id) {
      return new Response('Missing required fields', { status: 400 });
    }

    const id = crypto.randomUUID();
    await createAttendanceSession(env, {
      id,
      institution_id,
      record_id,
      card_id: null,
      message_id: null,
      open_message_id: null,
      course_name: course_name || '',
      class_name: class_name || '',
      teacher_name: teacher_name || '',
      scheduled_time: scheduled_time || null,
      status: 'active',
    });

    const session = await getAttendanceSession(env, id);
    return new Response(JSON.stringify(session), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function updateSession(
  env: Env,
  id: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json();
    await updateAttendanceSession(env, id, body);

    const session = await getAttendanceSession(env, id);
    return new Response(JSON.stringify(session), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function signStudent(
  env: Env,
  sessionId: string,
  request: Request
): Promise<Response> {
  try {
    const body = await request.json();
    const { student_name, student_record_id, status } = body;

    if (!student_name || !status) {
      return new Response('Missing required fields', { status: 400 });
    }

    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    if (session.status !== 'active') {
      return new Response('Session is not active', { status: 400 });
    }

    // Get institution for bitable access
    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id || '',
    };

    // Get sign record table ID
    const signTableId = institution.bitable_sign_record_table_id;
    if (!signTableId) {
      return new Response('Sign record table not configured', { status: 400 });
    }

    // Map status to bitable value
    const statusMap: Record<string, string> = {
      sign_in: '已到',
      leave: '请假',
      absent: '缺勤',
    };

    const bitableStatus = statusMap[status] || status;

    // Update or create attendance record in bitable
    let fromStatus = 'pending';
    if (student_record_id) {
      fromStatus = 'existing';
      await bitable.updateAttendance(bitableConfig, signTableId, student_record_id, bitableStatus, 'H5点名');
    } else {
      // Create new record
      fromStatus = 'new';
      await bitable.addAttendanceRecord(
        bitableConfig,
        signTableId,
        student_name,
        '', // campus_name
        session.course_name || '',
        session.class_name || '',
        session.scheduled_time || Date.now(),
        bitableStatus,
        'H5点名'
      );
    }

    // Write log
    await createAttendanceLog(env, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      student_id: student_record_id || 'unknown',
      student_name: student_name,
      action: status,
      from_status: fromStatus,
      to_status: status,
      operator_id: 'system',
      operator_name: null,
      reason: null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Sign student error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function getSessionStudents(env: Env, sessionId: string): Promise<Response> {
  try {
    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!institution.bitable_base_id || !institution.bitable_student_table_id) {
      return new Response(JSON.stringify({
        error: 'Bitable not configured',
        students: [],
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id,
    };

    const students = await bitable.getStudents(bitableConfig, institution.bitable_student_table_id);

    // Also scan for makeup students from sign record table
    let makeupStudents: any[] = [];
    if (institution.bitable_sign_record_table_id && session.course_name && session.class_name) {
      const makeupRecords = await bitable.getMakeupRecords(
        bitableConfig,
        institution.bitable_sign_record_table_id,
        session.course_name,
        session.class_name,
        session.scheduled_time || Date.now()
      );

      makeupStudents = makeupRecords.map(record => ({
        record_id: record.record_id,
        name: record.name,
        isMakeup: true,
        sign_method: '补课',
        course_name: session.course_name,
        class_name: session.class_name,
      }));
    }

    return new Response(JSON.stringify({ students, makeupStudents }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get session students error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function getSessionAbsences(env: Env, sessionId: string): Promise<Response> {
  try {
    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!institution.bitable_base_id || !institution.bitable_sign_record_table_id) {
      return new Response(JSON.stringify({ absences: [], error: 'Bitable not configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id,
    };

    // Get all records from sign record table
    const records = await bitable.getRecords(bitableConfig, institution.bitable_sign_record_table_id);

    // Filter for absences in this session (excluding makeup which is already "已到")
    const absences = records.filter(record => {
      const fields = record.fields || {};
      const isAbsence = fields['签到情况'] === '缺勤';
      const isMatchCourse = fields['课程'] === session.course_name && fields['班级'] === session.class_name;
      return isAbsence && isMatchCourse;
    }).map(record => ({
      record_id: record.record_id,
      name: record.fields?.['姓名'] || '',
      course_name: record.fields?.['课程'] || '',
      class_name: record.fields?.['班级'] || '',
      scheduled_time: record.fields?.['上课时间'] || null,
    }));

    return new Response(JSON.stringify({ absences }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get session absences error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function makeupSign(env: Env, sessionId: string, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { student_record_id, student_name } = body;

    if (!student_record_id) {
      return new Response('Missing student_record_id', { status: 400 });
    }

    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!institution.bitable_base_id || !institution.bitable_sign_record_table_id) {
      return new Response('Bitable not configured', { status: 400 });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id,
    };

    // Update the attendance record to "已到" (sign_in)
    await bitable.updateAttendance(bitableConfig, institution.bitable_sign_record_table_id, student_record_id, '已到', '补签');

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Makeup sign error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function searchStudents(env: Env, sessionId: string, keyword: string): Promise<Response> {
  try {
    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!institution.bitable_base_id || !institution.bitable_student_table_id) {
      return new Response(JSON.stringify({ students: [], error: 'Bitable not configured' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id,
    };

    // Get all students and filter by keyword
    const students = await bitable.getStudents(bitableConfig, institution.bitable_student_table_id);
    const filtered = students.filter(s =>
      s.name && s.name.toLowerCase().includes(keyword.toLowerCase())
    );

    return new Response(JSON.stringify({ students: filtered }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search students error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function addTempStudent(env: Env, sessionId: string, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { student_record_id, student_name, action, original_class } = body;

    if (!student_record_id || !student_name || !action) {
      return new Response('Missing required fields', { status: 400 });
    }

    if (action !== 'temp_makeup' && action !== 'transfer_class') {
      return new Response('Invalid action, must be temp_makeup or transfer_class', { status: 400 });
    }

    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!institution.bitable_base_id || !institution.bitable_sign_record_table_id) {
      return new Response('Bitable not configured', { status: 400 });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id,
    };

    // If transfer_class, update student's class in bitable
    if (action === 'transfer_class' && original_class) {
      await bitable.updateRecord(bitableConfig, institution.bitable_student_table_id, student_record_id, {
        '所属班级': session.class_name,
      });
    }

    // Add attendance record
    await bitable.addAttendanceRecord(
      bitableConfig,
      institution.bitable_sign_record_table_id,
      student_name,
      '', // campus_name
      session.course_name || '',
      session.class_name || '',
      session.scheduled_time || Date.now(),
      '待签到',
      action === 'transfer_class' ? '调班' : '临时补课'
    );

    // Write log
    await createAttendanceLog(env, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      student_id: student_record_id,
      student_name: student_name,
      action: 'add_temp',
      from_status: null,
      to_status: 'temp_added',
      operator_id: 'system',
      operator_name: null,
      reason: action === 'transfer_class' ? `从${original_class}调入` : '临时补课',
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Add temp student error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function undoSign(env: Env, sessionId: string, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { student_record_id, student_name, from_status, reason } = body;

    if (!student_record_id) {
      return new Response('Missing student_record_id', { status: 400 });
    }

    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    const institution = await getInstitutionById(env, session.institution_id);
    if (!institution) {
      return new Response('Institution not found', { status: 404 });
    }

    if (!institution.bitable_base_id || !institution.bitable_sign_record_table_id) {
      return new Response('Bitable not configured', { status: 400 });
    }

    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id,
    };

    // Update bitable record back to pending
    await bitable.updateAttendance(bitableConfig, institution.bitable_sign_record_table_id, student_record_id, '待签到', '撤销');

    // Write log
    await createAttendanceLog(env, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      student_id: student_record_id,
      student_name: student_name || null,
      action: 'undo_sign',
      from_status: from_status || null,
      to_status: 'pending',
      operator_id: 'system',
      operator_name: null,
      reason: reason || null,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Undo sign error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function getLogs(env: Env, sessionId: string): Promise<Response> {
  try {
    const logs = await listAttendanceLogs(env, sessionId);
    return new Response(JSON.stringify({ logs }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

async function endSession(env: Env, sessionId: string, request: Request): Promise<Response> {
  try {
    const session = await getAttendanceSession(env, sessionId);
    if (!session) {
      return new Response('Session not found', { status: 404 });
    }

    if (session.status === 'completed') {
      return new Response('Session already ended', { status: 400 });
    }

    const now = Date.now();
    await updateAttendanceSession(env, sessionId, {
      status: 'completed',
      completed_at: now,
    });

    // Write log
    await createAttendanceLog(env, {
      id: crypto.randomUUID(),
      session_id: sessionId,
      student_id: 'system',
      student_name: null,
      action: 'end_session',
      from_status: session.status,
      to_status: 'completed',
      operator_id: 'system',
      operator_name: null,
      reason: '下课锁定',
    });

    return new Response(JSON.stringify({ success: true, completed_at: now }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('End session error:', error);
    return new Response(`Error: ${error}`, { status: 500 });
  }
}

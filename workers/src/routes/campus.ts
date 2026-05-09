/**
 * Campus Management Handler
 * Provides CRUD operations for students, courses, and classes via Bitable API
 */

import { Env, getInstitutionById, getAuthorizedUser } from '../db/queries';
import * as bitable from '../services/bitable';

function buildBitableConfig(institution: any): bitable.BitableConfig {
  return {
    appId: institution.feishu_app_id,
    appSecret: institution.feishu_app_secret,
    baseId: institution.bitable_base_id || '',
  };
}

export async function handleCampusRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Extract institution_id from path: /api/campus/:institutionId/...
  const pathParts = path.split('/').filter(Boolean); // [api, campus, institutionId, resource, id?]
  if (pathParts.length < 3) {
    return new Response(JSON.stringify({ error: 'Invalid path' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const institutionId = pathParts[2];
  const resource = pathParts[3] || ''; // students, courses, classes
  const resourceId = pathParts[4] || ''; // record_id for specific resource

  // Get institution
  const institution = await getInstitutionById(env, institutionId);
  if (!institution) {
    return new Response(JSON.stringify({ error: 'Institution not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }

  const bitableConfig = buildBitableConfig(institution);

  try {
    // Route based on resource
    switch (resource) {
      case 'students':
        return await handleStudents(env, bitableConfig, institution.bitable_student_table_id, method, resourceId, request);

      case 'courses':
        return await handleCourses(env, bitableConfig, institution.bitable_schedule_table_id, method, resourceId, request);

      case 'classes':
        return await handleClasses(env, bitableConfig, institution.bitable_schedule_table_id, method, resourceId, request);

      case 'data':
        // GET /api/campus/:institutionId/data - get all data at once
        if (method === 'GET') {
          return await handleGetAllData(bitableConfig, institution);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });

      default:
        return new Response(JSON.stringify({ error: 'Unknown resource' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (error) {
    console.error('Campus API error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleStudents(
  env: Env,
  config: bitable.BitableConfig,
  tableId: string | null,
  method: string,
  recordId: string,
  request: Request
): Promise<Response> {
  if (!tableId) {
    return new Response(JSON.stringify({ error: 'Student table not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  switch (method) {
    case 'GET':
      if (recordId) {
        const record = await bitable.getRecord(config, tableId, recordId);
        return new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } });
      }
      const students = await bitable.getStudents(config, tableId);
      return new Response(JSON.stringify(students), { headers: { 'Content-Type': 'application/json' } });

    case 'POST': {
      const body = await request.json();
      const recordId = await bitable.createRecord(config, tableId, body);
      return new Response(JSON.stringify({ record_id: recordId }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }

    case 'PUT': {
      if (!recordId) {
        return new Response(JSON.stringify({ error: 'Record ID required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      const body = await request.json();
      await bitable.updateRecord(config, tableId, recordId, body);
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    case 'DELETE': {
      if (!recordId) {
        return new Response(JSON.stringify({ error: 'Record ID required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      // Bitable doesn't have delete, but we could mark as deleted or just return success
      return new Response(JSON.stringify({ success: true, message: 'Delete not supported in Bitable read-only mode' }), { headers: { 'Content-Type': 'application/json' } });
    }

    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleCourses(
  env: Env,
  config: bitable.BitableConfig,
  tableId: string | null,
  method: string,
  recordId: string,
  request: Request
): Promise<Response> {
  if (!tableId) {
    return new Response(JSON.stringify({ error: 'Schedule table not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  switch (method) {
    case 'GET': {
      if (recordId) {
        const record = await bitable.getRecord(config, tableId, recordId);
        return new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } });
      }
      // Get all records and extract unique courses
      const records = await bitable.getRecords(config, tableId);
      const coursesMap = new Map<string, any>();
      records.forEach((record: any) => {
        const courseName = record.fields?.['课程名称'] || record.fields?.['课程'] || '';
        if (courseName && !coursesMap.has(courseName)) {
          coursesMap.set(courseName, {
            record_id: `course_${courseName}`,
            name: courseName,
            description: record.fields?.['课程描述'] || record.fields?.['描述'] || '',
          });
        }
      });
      const courses = Array.from(coursesMap.values());
      return new Response(JSON.stringify(courses), { headers: { 'Content-Type': 'application/json' } });
    }

    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleClasses(
  env: Env,
  config: bitable.BitableConfig,
  tableId: string | null,
  method: string,
  recordId: string,
  request: Request
): Promise<Response> {
  if (!tableId) {
    return new Response(JSON.stringify({ error: 'Schedule table not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  switch (method) {
    case 'GET': {
      if (recordId) {
        const record = await bitable.getRecord(config, tableId, recordId);
        return new Response(JSON.stringify(record), { headers: { 'Content-Type': 'application/json' } });
      }
      // Get all records and extract unique class/grade info
      const records = await bitable.getRecords(config, tableId);
      const classesMap = new Map<string, any>();
      records.forEach((record: any) => {
        const className = record.fields?.['班级名称'] || record.fields?.['班级'] || '';
        if (className && !classesMap.has(className)) {
          classesMap.set(className, {
            record_id: `class_${className}`,
            name: className,
            course_name: record.fields?.['课程名称'] || record.fields?.['课程'] || '',
            teacher_name: record.fields?.['老师'] || record.fields?.['教师'] || '',
          });
        }
      });
      const classes = Array.from(classesMap.values());
      return new Response(JSON.stringify(classes), { headers: { 'Content-Type': 'application/json' } });
    }

    default:
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleGetAllData(
  config: bitable.BitableConfig,
  institution: any
): Promise<Response> {
  const studentTableId = institution.bitable_student_table_id;
  const scheduleTableId = institution.bitable_schedule_table_id;

  const [students, courses, classes] = await Promise.all([
    studentTableId ? bitable.getStudents(config, studentTableId) : [],
    scheduleTableId ? getUniqueCourses(config, scheduleTableId) : [],
    scheduleTableId ? getUniqueClasses(config, scheduleTableId) : [],
  ]);

  return new Response(JSON.stringify({ students, courses, classes }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getUniqueCourses(config: bitable.BitableConfig, tableId: string): Promise<any[]> {
  const records = await bitable.getRecords(config, tableId);
  const coursesMap = new Map<string, any>();
  records.forEach((record: any) => {
    const courseName = record.fields?.['课程名称'] || record.fields?.['课程'] || '';
    if (courseName && !coursesMap.has(courseName)) {
      coursesMap.set(courseName, {
        record_id: `course_${courseName}`,
        name: courseName,
        description: record.fields?.['课程描述'] || record.fields?.['描述'] || '',
      });
    }
  });
  return Array.from(coursesMap.values());
}

async function getUniqueClasses(config: bitable.BitableConfig, tableId: string): Promise<any[]> {
  const records = await bitable.getRecords(config, tableId);
  const classesMap = new Map<string, any>();
  records.forEach((record: any) => {
    const className = record.fields?.['班级名称'] || record.fields?.['班级'] || '';
    if (className && !classesMap.has(className)) {
      classesMap.set(className, {
        record_id: `class_${className}`,
        name: className,
        course_name: record.fields?.['课程名称'] || record.fields?.['课程'] || '',
        teacher_name: record.fields?.['老师'] || record.fields?.['教师'] || '',
      });
    }
  });
  return Array.from(classesMap.values());
}
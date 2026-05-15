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

// Helper function to extract text from field value (handles user mentions, etc.)
function extractText(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map(v => {
      if (typeof v === 'string') return v;
      if (v.text) return v.text;
      if (v.text_arr && Array.isArray(v.text_arr)) return v.text_arr.join(',');
      return '';
    }).filter(Boolean).join(',');
  }
  if (typeof value === 'object' && value.text) return value.text;
  return String(value);
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

      case 'schedules':
        // GET /api/campus/:institutionId/schedules - get all schedule records
        if (method === 'GET') {
          return await handleSchedules(bitableConfig, institution);
        }
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json' } });

      case 'holidays':
        // GET /api/campus/:institutionId/holidays - get holiday calendar
        if (method === 'GET') {
          return await handleHolidays(bitableConfig, institution);
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

async function handleSchedules(
  config: bitable.BitableConfig,
  institution: any
): Promise<Response> {
  const scheduleTableId = institution.bitable_schedule_table_id;
  if (!scheduleTableId) {
    return new Response(JSON.stringify({ error: 'Schedule table not configured' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Resolve wiki URL to app_token if needed
    let resolvedBaseId = config.baseId;
    try {
      resolvedBaseId = await bitable.resolveBitableAppToken(config, config.baseId);
    } catch (e) {
      console.log('Failed to resolve bitable app_token, using original:', e);
    }
    const resolvedConfig = { ...config, baseId: resolvedBaseId };

    const records = await bitable.getRecords(resolvedConfig, scheduleTableId);
    // Map to simplified schedule structure
    const schedules = records.map((record: any) => {
      // Helper function to extract text from field value (handles user mentions, etc.)
      const extractText = (value: any): string => {
        if (!value) return '';
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
          // Handle user mentions array
          return value.map(v => {
            if (typeof v === 'string') return v;
            if (v.text) return v.text;
            if (v.text_arr && Array.isArray(v.text_arr)) return v.text_arr.join(',');
            return '';
          }).filter(Boolean).join(',');
        }
        if (typeof value === 'object' && value.text) return value.text;
        return String(value);
      };

      return {
        record_id: record.record_id,
        class_name: extractText(record.fields?.['班级'] || record.fields?.['课程名称'] || ''),
        course_name: extractText(record.fields?.['课程'] || record.fields?.['课程名称'] || ''),
        teacher_name: extractText(record.fields?.['上课老师'] || ''),
        scheduled_time: record.fields?.['上课时间'] || null,
        end_time: record.fields?.['下课时间'] || null,
        day_of_week: extractText(record.fields?.['星期'] || ''),
        duration_minutes: record.fields?.['时长'] || 0,
        student_count: record.fields?.['学员人数'] || 0,
        students: extractText(record.fields?.['学员名单'] || ''),
        campus: extractText(record.fields?.['校区'] || record.fields?.['上课地点'] || ''),
      };
    });

    return new Response(JSON.stringify({ schedules }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch schedules:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleHolidays(
  config: bitable.BitableConfig,
  institution: any
): Promise<Response> {
  // Get holiday table ID from institution's bitable_tables
  const bitableTables = institution.bitable_tables ? JSON.parse(institution.bitable_tables) : {};
  const holidayTableId = bitableTables['假期日历'];

  if (!holidayTableId) {
    return new Response(JSON.stringify({ holidays: [] }), { headers: { 'Content-Type': 'application/json' } });
  }

  try {
    // Resolve wiki URL if needed
    let resolvedBaseId = config.baseId;
    try {
      resolvedBaseId = await bitable.resolveBitableAppToken(config, config.baseId);
    } catch (e) {
      console.log('Failed to resolve bitable app_token, using original');
    }
    const resolvedConfig = { ...config, baseId: resolvedBaseId };

    const records = await bitable.getRecords(resolvedConfig, holidayTableId);

    const holidays = records.map((record: any) => ({
      record_id: record.record_id,
      start_date: record.fields?.['开始日期'] || null,
      end_date: record.fields?.['结束日期'] || null,
      type: extractText(record.fields?.['类型'] || ''),
      duration_days: record.fields?.['时长(天)'] || 0,
      package_id: record.fields?.['指定课时包']?.id || null,
      remark: extractText(record.fields?.['备注'] || ''),
    }));

    return new Response(JSON.stringify({ holidays }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch holidays:', error);
    return new Response(JSON.stringify({ error: String(error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
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
/**
 * Admin Schedule Management Handler
 * Sync schedule records to cron jobs
 */

import { Env, getAdminUserById, listCronJobs, createCronJob, updateCronJob, deleteCronJob, getInstitutionById, listInstitutions } from '../db/queries';
import * as bitable from '../services/bitable';

export async function handleAdminScheduleRequest(
  env: Env,
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Auth check
  const authError = await checkAuth(request, env);
  if (authError) return authError;

  // Route: POST /api/admin/schedule/sync
  if (request.method === 'POST' && path === '/api/admin/schedule/sync') {
    return await syncSchedules(env, request);
  }

  // Route: GET /api/admin/schedule/sync
  if (request.method === 'GET' && path === '/api/admin/schedule/sync') {
    return await getScheduleStatus(env, request);
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

interface ScheduleRecord {
  record_id: string;
  course_type: string;
  weekday: string | null; // 有值=循环（如"周一"），空=固定日期
  class_time: string; // 上课时间 "HH:mm"
  end_time: string; // 下课时间 "HH:mm"
  duration_minutes: number;
  course_name: string;
  campus: string;
  scheduled_date: number | null; // 具体日期时间戳（固定课程用）
}

async function syncSchedules(env: Env, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { institution_id } = body;

    if (!institution_id) {
      return new Response(JSON.stringify({ error: '缺少机构ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get institution
    const institution = await getInstitutionById(env, institution_id);
    if (!institution) {
      return new Response(JSON.stringify({ error: '机构不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build bitable config
    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id || '',
    };

    // Resolve wiki URL if needed
    let resolvedBaseId = bitableConfig.baseId;
    try {
      resolvedBaseId = await bitable.resolveBitableAppToken(bitableConfig, bitableConfig.baseId);
    } catch (e) {
      console.log('Failed to resolve bitable app_token');
    }
    const config = { ...bitableConfig, baseId: resolvedBaseId };

    // Get schedule table
    const scheduleTableId = institution.bitable_schedule_table_id;
    if (!scheduleTableId) {
      return new Response(JSON.stringify({ error: '未配置排课管理表' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fetch all schedule records
    const records = await bitable.getRecords(config, scheduleTableId);

    // Get existing cron jobs for this institution
    const existingJobs = await listCronJobs(env, institution_id);
    const existingJobMap = new Map(existingJobs.map(j => {
      const jobConfig = j.config ? JSON.parse(j.config) : {};
      return [jobConfig.record_id, j];
    }));

    // Parse schedule records and create/update cron jobs
    const parsedSchedules: ScheduleRecord[] = records.map((record: any) => {
      const fields = record.fields;
      const dateField = fields['日期']; // 单选：有值=循环，无值=固定
      const classTime = fields['上课时间'];
      const endTime = fields['下课时间'];

      // 提取星期几
      let weekday: string | null = null;
      if (dateField && typeof dateField === 'string') {
        weekday = dateField; // "周一"、"周二"等
      }

      // 提取上课时间 HH:mm
      let classTimeStr = '';
      let endTimeStr = '';
      if (classTime) {
        const d = new Date(classTime);
        classTimeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }
      if (endTime) {
        const d = new Date(endTime);
        endTimeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }

      return {
        record_id: record.record_id,
        course_type: extractText(fields['课程'] || ''),
        weekday,
        class_time: classTimeStr,
        end_time: endTimeStr,
        duration_minutes: fields['课程时长'] || 90,
        course_name: extractText(fields['班级名称'] || fields['课程'] || ''),
        campus: extractText(fields['所属校区'] || ''),
        scheduled_date: classTime ? new Date(classTime).getTime() : null,
      };
    });

    // Get holiday info for vacation check
    const bitableTables = institution.bitable_tables ? JSON.parse(institution.bitable_tables) : {};
    const holidayTableId = bitableTables['假期日历'];
    let holidays: any[] = [];
    if (holidayTableId) {
      const holidayRecords = await bitable.getRecords(config, holidayTableId);
      holidays = holidayRecords.map((r: any) => ({
        start: r.fields?.['开始日期'],
        end: r.fields?.['结束日期'],
        type: extractText(r.fields?.['类型'] || ''),
      }));
    }

    // Create/update cron jobs
    const results = {
      created: 0,
      updated: 0,
      deleted: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const schedule of parsedSchedules) {
      try {
        // Determine cron expression
        let cronSchedule: string;
        let isFixedDate = false;

        if (schedule.weekday) {
          // 循环课程：根据星期和时间生成
          const weekdayNum = weekdayToNumber(schedule.weekday);
          const [hour, minute] = schedule.class_time.split(':');
          cronSchedule = `${minute} ${hour} * * ${weekdayNum}`;
        } else if (schedule.scheduled_date) {
          // 固定日期课程：使用具体日期
          const date = new Date(schedule.scheduled_date);
          const day = date.getDate();
          const month = date.getMonth() + 1;
          const [hour, minute] = schedule.class_time.split(':');
          cronSchedule = `${minute} ${hour} ${day} ${month} *`;
          isFixedDate = true;
        } else {
          // 没有时间信息，跳过
          results.skipped++;
          continue;
        }

        // Check if today's date is in vacation (only for display info)
        let vacationType: string | null = null;
        if (schedule.weekday && holidays.length > 0) {
          const today = new Date();
          for (const h of holidays) {
            if (h.start && h.end) {
              const startDate = new Date(h.start);
              const endDate = new Date(h.end);
              if (today >= startDate && today <= endDate) {
                vacationType = h.type;
                break;
              }
            }
          }
        }

        const jobConfig = {
          record_id: schedule.record_id,
          course_type: schedule.course_type,
          course_name: schedule.course_name,
          weekday: schedule.weekday,
          class_time: schedule.class_time,
          end_time: schedule.end_time,
          duration_minutes: schedule.duration_minutes,
          campus: schedule.campus,
          is_fixed_date: isFixedDate,
          scheduled_date: schedule.scheduled_date,
          vacation_type: vacationType,
        };

        const existingJob = existingJobMap.get(schedule.record_id);

        if (existingJob) {
          // Update existing job
          await updateCronJob(env, existingJob.id, {
            schedule: cronSchedule,
            config: JSON.stringify(jobConfig),
            enabled: 1,
          });
          results.updated++;
        } else {
          // Create new job
          const id = crypto.randomUUID();
          await createCronJob(env, {
            id,
            institution_id: institution_id,
            job_type: isFixedDate ? 'class_reminder_fixed' : 'class_reminder',
            schedule: cronSchedule,
            enabled: 1,
            config: JSON.stringify(jobConfig),
          });
          results.created++;
        }
      } catch (err) {
        results.errors.push(`Record ${schedule.record_id}: ${String(err)}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      total_records: parsedSchedules.length,
      results,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Sync schedules error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function getScheduleStatus(env: Env, request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const institutionId = url.searchParams.get('institution_id');

    if (!institutionId) {
      return new Response(JSON.stringify({ error: '缺少机构ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get institution
    const institution = await getInstitutionById(env, institutionId);
    if (!institution) {
      return new Response(JSON.stringify({ error: '机构不存在' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Get schedule table
    const scheduleTableId = institution.bitable_schedule_table_id;
    if (!scheduleTableId) {
      return new Response(JSON.stringify({ error: '未配置排课管理表' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build bitable config
    const bitableConfig = {
      appId: institution.feishu_app_id,
      appSecret: institution.feishu_app_secret,
      baseId: institution.bitable_base_id || '',
    };

    // Resolve wiki URL if needed
    let resolvedBaseId = bitableConfig.baseId;
    try {
      resolvedBaseId = await bitable.resolveBitableAppToken(bitableConfig, bitableConfig.baseId);
    } catch (e) {
      console.log('Failed to resolve bitable app_token');
    }
    const config = { ...bitableConfig, baseId: resolvedBaseId };

    // Fetch schedule records
    const records = await bitable.getRecords(config, scheduleTableId);

    // Get cron jobs
    const cronJobs = await listCronJobs(env, institutionId);
    const cronJobMap = new Map(cronJobs.map(j => {
      const jobConfig = j.config ? JSON.parse(j.config) : {};
      return [jobConfig.record_id, j];
    }));

    // Build schedule list with cron status
    const schedules = records.map((record: any) => {
      const fields = record.fields;
      const dateField = fields['日期'];
      const classTime = fields['上课时间'];

      let weekday: string | null = null;
      if (dateField && typeof dateField === 'string') {
        weekday = dateField;
      }

      let classTimeStr = '';
      if (classTime) {
        const d = new Date(classTime);
        classTimeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
      }

      const cronJob = cronJobMap.get(record.record_id);

      return {
        record_id: record.record_id,
        course_type: extractText(fields['课程'] || ''),
        course_name: extractText(fields['班级名称'] || ''),
        weekday,
        class_time: classTimeStr,
        duration_minutes: fields['课程时长'] || 0,
        campus: extractText(fields['所属校区'] || ''),
        cron_job_id: cronJob?.id || null,
        cron_enabled: cronJob?.enabled === 1,
        cron_schedule: cronJob?.schedule || null,
      };
    });

    return new Response(JSON.stringify({
      schedules,
      total_cron_jobs: cronJobs.length,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Get schedule status error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Helper function: extract text from field value
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

// Helper function: convert weekday to cron number
function weekdayToNumber(weekday: string): number {
  const map: Record<string, number> = {
    '周日': 0,
    '周一': 1,
    '周二': 2,
    '周三': 3,
    '周四': 4,
    '周五': 5,
    '周六': 6,
  };
  return map[weekday] ?? 1;
}
/**
 * Cron Job Handler
 * Executes scheduled tasks
 */

import { Env } from '../db/queries';
import {
  getEnabledCronJobs,
  updateCronJob,
  getInstitutionById,
  createAttendanceSession,
  getAttendanceSession,
  listAttendanceSessions,
  listAttendanceLogs,
  updateAttendanceSession,
  getCronJob,
} from '../db/queries';
import { sendAttendanceCard, sendCardMessage } from '../services/feishu-api';
import * as bitable from '../services/bitable';

export type CronJobType = 'class_reminder' | 'class_reminder_fixed' | 'attendance_summary' | 'course_time_advance';

export interface CronJobConfig {
  record_id?: string;
  course_type?: string;
  course_name?: string;
  class_name?: string;
  weekday?: string;
  class_time?: string;
  end_time?: string;
  duration_minutes?: number;
  campus?: string;
  is_fixed_date?: boolean;
  scheduled_date?: number;
  vacation_type?: string;
  target_type?: 'chat_id' | 'open_id';
  target_id?: string;
  reminder_minutes?: number;
  advance_days?: number;
  notify_chat?: boolean;
}

/**
 * Handle cron trigger (called by Cloudflare Cron)
 */
export async function handleCronTrigger(env: Env): Promise<void> {
  console.log('Cron trigger fired at', new Date().toISOString());

  // Get all enabled cron jobs
  const jobs = await getEnabledCronJobs(env);

  for (const job of jobs) {
    try {
      await executeCronJob(env, job);
    } catch (error) {
      console.error(`Cron job ${job.id} failed:`, error);
    }
  }
}

export async function executeCronJobById(env: Env, jobId: string): Promise<void> {
  const job = await getCronJob(env, jobId);
  if (!job) {
    throw new Error(`Cron job ${jobId} not found`);
  }
  if (job.enabled !== 1) {
    console.log(`Cron job ${jobId} is disabled, skipping`);
    return;
  }
  await executeCronJob(env, job);
}

async function executeCronJob(env: Env, job: any): Promise<void> {
  const config: CronJobConfig = job.config ? JSON.parse(job.config) : {};

  // Get institution
  const institution = await getInstitutionById(env, job.institution_id);
  if (!institution || institution.status !== 'active') {
    console.log(`Institution ${job.institution_id} is not active, skipping job ${job.id}`);
    return;
  }

  const now = Date.now();

  // Check if should run now based on job type and schedule
  if (!shouldRunNow(now, job.schedule, job.job_type)) {
    return;
  }

  console.log(`Executing cron job ${job.id} of type ${job.job_type}`);

  if (job.job_type === 'class_reminder' || job.job_type === 'class_reminder_fixed') {
    await executeClassReminder(env, job, institution, config);
  } else if (job.job_type === 'attendance_summary') {
    await executeAttendanceSummary(env, job, institution, config);
  } else if (job.job_type === 'course_time_advance') {
    await executeCourseTimeAdvance(env, job, institution, config);
  }

  // Update last_run_at
  await updateCronJob(env, job.id, { last_run_at: now });
}

async function executeClassReminder(
  env: Env,
  job: any,
  institution: any,
  config: CronJobConfig
): Promise<void> {
  const bitableConfig = {
    appId: institution.feishu_app_id,
    appSecret: institution.feishu_app_secret,
    baseId: institution.bitable_base_id || '',
  };

  // Resolve bitable app_token if it's a wiki URL
  let resolvedBaseId = bitableConfig.baseId;
  if (resolvedBaseId) {
    try {
      resolvedBaseId = await bitable.resolveBitableAppToken(bitableConfig, resolvedBaseId);
    } catch (e) {
      console.log('Failed to resolve bitable app_token from wiki URL, using original:', e);
    }
  }

  const finalBitableConfig = { ...bitableConfig, baseId: resolvedBaseId };
  const scheduleTableId = institution.bitable_schedule_table_id;

  if (!scheduleTableId) {
    console.log('Schedule table not configured');
    return;
  }

  const now = Date.now();

  // Check if today is in a holiday period (放假 type skips)
  const holidayStatus = await isInHoliday(now, institution, finalBitableConfig);
  if (holidayStatus.isHoliday) {
    console.log(`Today is in ${holidayStatus.holidayType} period, skipping class reminder`);
    return;
  }

  // For fixed date courses (class_reminder_fixed), check if today matches the scheduled date
  if (job.job_type === 'class_reminder_fixed' && config.scheduled_date) {
    const scheduledDate = new Date(config.scheduled_date);
    const today = new Date(now);
    // Check if it's the same day
    if (scheduledDate.getDate() !== today.getDate() ||
        scheduledDate.getMonth() !== today.getMonth() ||
        scheduledDate.getFullYear() !== today.getFullYear()) {
      console.log('Fixed date course not today, skipping');
      return;
    }
  }

  // Get all schedule records and find the matching one
  const allRecords = await bitable.getRecords(finalBitableConfig, scheduleTableId);

  // Find the record that matches this cron job's config
  const matchingRecord = allRecords.find((record: any) => {
    // Match by record_id if available
    if (config.record_id && record.record_id === config.record_id) {
      return true;
    }
    // Fallback: match by course_type, weekday, and class_time
    if (config.course_type && config.weekday && config.class_time) {
      const fields = record.fields;
      const recordWeekday = fields['日期'];
      const recordClassTime = fields['上课时间'];

      // Check weekday match (e.g., "周一" === "周一")
      if (recordWeekday !== config.weekday) {
        return false;
      }

      // Check time match
      if (recordClassTime) {
        const d = new Date(recordClassTime);
        const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
        if (timeStr !== config.class_time) {
          return false;
        }
      }

      return true;
    }
    return false;
  });

  if (!matchingRecord) {
    console.log('No matching schedule record found for this cron job');
    return;
  }

  const fields = matchingRecord.fields;
  const courseName = extractText(fields['课程'] || fields['course_name'] || '');
  const className = extractText(fields['班级名称'] || fields['班级'] || config.course_name || '');
  const teacherName = extractText(fields['上课老师'] || '');
  const scheduledTime = fields['上课时间'];
  const recordId = matchingRecord.record_id;

  // Format scheduled time for display
  const date = new Date(scheduledTime);
  const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  // Create attendance session
  const sessionId = crypto.randomUUID();
  await createAttendanceSession(env, {
    id: sessionId,
    institution_id: institution.id,
    record_id: recordId,
    card_id: null,
    message_id: null,
    open_message_id: null,
    course_name: courseName,
    class_name: className,
    teacher_name: teacherName,
    scheduled_time: scheduledTime,
    status: 'active',
  });

  // Send attendance card
  try {
    // Use target from job config or fallback to cron job config
    const targetId = config.target_id || '';
    const targetType = (config.target_type || 'chat_id') as 'chat_id' | 'open_id';

    const cardResult = await sendAttendanceCard(
      {
        appId: institution.feishu_app_id,
        appSecret: institution.feishu_app_secret,
      },
      targetId,
      targetType,
      sessionId,
      recordId,
      null, // openMessageId not available at cron time
      courseName,
      className,
      teacherName,
      timeStr
    );

    console.log(`Sent attendance card for session ${sessionId}, message_id: ${cardResult.messageId}`);

    // Update session with card_id and message_id
    await updateAttendanceSession(env, sessionId, {
      card_id: cardResult.cardId,
      message_id: cardResult.messageId,
    });
  } catch (error) {
    console.error(`Failed to send attendance card:`, error);
  }
}

async function executeAttendanceSummary(
  env: Env,
  job: any,
  institution: any,
  config: CronJobConfig
): Promise<void> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfDay = today.getTime();
  const endOfDay = startOfDay + 24 * 60 * 60 * 1000;

  // Get today's completed sessions for this institution
  const sessions = await listAttendanceSessions(env, institution.id, 'completed');
  const todaySessions = sessions.filter(s =>
    s.completed_at && s.completed_at >= startOfDay && s.completed_at < endOfDay
  );

  // Count statuses from logs
  let signIn = 0, leave = 0, absent = 0;
  for (const session of todaySessions) {
    const logs = await listAttendanceLogs(env, session.id);
    logs.forEach(log => {
      if (log.action === 'sign_in') signIn++;
      else if (log.action === 'leave') leave++;
      else if (log.action === 'absent') absent++;
    });
  }

  // Generate summary text
  const dateStr = new Date().toLocaleDateString('zh-CN');
  const summary = `📊 ${dateStr} 考勤汇总\n` +
    `课程数: ${todaySessions.length}\n` +
    `✅ 已到: ${signIn}\n` +
    `📝 请假: ${leave}\n` +
    `❌ 缺勤: ${absent}`;

  // Send summary card
  const feishuConfig = {
    appId: institution.feishu_app_id,
    appSecret: institution.feishu_app_secret,
  };

  await sendCardMessage(
    feishuConfig,
    config.target_id,
    config.target_type as 'chat_id' | 'open_id',
    {
      type: 'card',
      data: {
        body: {
          elements: [{
            tag: 'div',
            text: { tag: 'plain_text', content: summary }
          }]
        }
      }
    }
  );
}

async function executeCourseTimeAdvance(
  env: Env,
  job: any,
  institution: any,
  config: CronJobConfig
): Promise<void> {
  if (!config.record_id) {
    console.log('course_time_advance job missing record_id');
    return;
  }

  const bitableConfig = {
    appId: institution.feishu_app_id,
    appSecret: institution.feishu_app_secret,
    baseId: institution.bitable_base_id || '',
  };

  const scheduleTableId = institution.bitable_schedule_table_id;
  if (!scheduleTableId) {
    console.log('Schedule table not configured');
    return;
  }

  const days = config.advance_days || 7;

  try {
    await bitable.advanceScheduleTime(bitableConfig, scheduleTableId, config.record_id, days);
    console.log(`Advanced schedule ${config.record_id} by ${days} days`);

    if (config.notify_chat) {
      const feishuConfig = {
        appId: institution.feishu_app_id,
        appSecret: institution.feishu_app_secret,
      };
      const courseInfo = config.course_name ? `${config.course_name} ${config.class_name || ''}` : `record ${config.record_id}`;
      await sendCardMessage(
        feishuConfig,
        config.target_id,
        config.target_type as 'chat_id' | 'open_id',
        {
          type: 'card',
          data: {
            body: {
              elements: [{
                tag: 'div',
                text: { tag: 'plain_text', content: `📅 ${courseInfo} 课程时间已自动顺延 ${days} 天` }
              }]
            }
          }
        }
      );
    }
  } catch (error) {
    console.error(`Failed to advance course time:`, error);
  }
}

/**
 * Parse cron schedule to determine if should run
 * Simplified version - in production use a proper cron parser
 */
function parseScheduleTime(schedule: string): { hour: number; minute: number; day?: number; month?: number; weekday?: number } {
  // Format: "0 9 * * *" = at 9:00 every day
  // Format: "0 9 1 5 *" = at 9:00 on day 1 of month 5 (May 1st)
  // Format: "10 16 * * 1" = at 16:10 on weekday 1 (Monday)
  const parts = schedule.split(' ');
  if (parts.length < 5) {
    return { hour: 9, minute: 0 };
  }

  const minute = parseInt(parts[0], 10) || 0;
  const hour = parseInt(parts[1], 10) || 9;
  const day = parts[2] === '*' ? null : parseInt(parts[2], 10);
  const month = parts[3] === '*' ? null : parseInt(parts[3], 10);
  const weekday = parts[4] === '*' ? null : parseInt(parts[4], 10);

  return { hour, minute, day, month, weekday };
}

function shouldRunNow(now: number, schedule: string, jobType: string): boolean {
  const date = new Date(now);
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();
  const currentDay = date.getDate();
  const currentMonth = date.getMonth() + 1;
  const currentWeekday = date.getDay();

  const scheduleInfo = parseScheduleTime(schedule);

  if (jobType === 'class_reminder') {
    // First check if time matches (this is the primary condition)
    const timeMatches = scheduleInfo.hour === currentHour && scheduleInfo.minute === currentMinute;

    // Check weekday constraint (if weekday is specified, must match)
    if (scheduleInfo.weekday !== null && scheduleInfo.weekday !== currentWeekday) {
      return false;
    }

    // Only run during business hours 7-21
    if (currentHour < 7 || currentHour > 21) {
      return false;
    }

    return timeMatches;
  } else if (jobType === 'class_reminder_fixed') {
    // Fixed date course: check exact date and time match
    if (scheduleInfo.day === currentDay && scheduleInfo.month === currentMonth) {
      return scheduleInfo.hour === currentHour && scheduleInfo.minute === currentMinute;
    }
    return false;
  }

  // For other jobs, check exact time
  return scheduleInfo.hour === currentHour && scheduleInfo.minute === currentMinute;
}

/**
 * Check if current date is in a holiday period
 */
async function isInHoliday(
  now: number,
  institution: any,
  finalBitableConfig: any
): Promise<{ isHoliday: boolean; holidayType: string | null }> {
  const bitableTables = institution.bitable_tables ? JSON.parse(institution.bitable_tables) : {};
  const holidayTableId = bitableTables['假期日历'];

  if (!holidayTableId) {
    return { isHoliday: false, holidayType: null };
  }

  try {
    const holidayRecords = await bitable.getRecords(finalBitableConfig, holidayTableId);
    const today = new Date(now);

    for (const record of holidayRecords) {
      const startDate = record.fields?.['开始日期'];
      const endDate = record.fields?.['结束日期'];
      const holidayType = extractText(record.fields?.['类型'] || '');

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (today >= start && today <= end) {
          // Check if it's a skip-worthy holiday (放假 skips, 寒假/暑假 checks course package)
          if (holidayType === '放假') {
            return { isHoliday: true, holidayType };
          }
          // For 寒假/暑假, we continue and check course package later
          return { isHoliday: false, holidayType };
        }
      }
    }
  } catch (e) {
    console.log('Error checking holidays:', e);
  }

  return { isHoliday: false, holidayType: null };
}

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

/**
 * Cron preset templates for H5 configuration
 */
export const CRON_PRESETS = [
  {
    id: 'morning_reminder',
    name: '课前提醒',
    description: '课前15分钟自动发送点名卡片',
    schedule: '0 * * * *', // Every hour, configurable via UI
    defaultConfig: {
      target_type: 'chat_id',
      reminder_minutes: 15,
    },
  },
  {
    id: 'end_of_class',
    name: '下课汇总',
    description: '下课时间发送考勤汇总',
    schedule: '0 18 * * *', // Every day at 18:00, configurable via UI
    defaultConfig: {
      target_type: 'chat_id',
    },
  },
];

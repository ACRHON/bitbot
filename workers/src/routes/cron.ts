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
} from '../db/queries';
import { sendAttendanceCard, sendCardMessage } from '../services/feishu-api';
import * as bitable from '../services/bitable';

export type CronJobType = 'class_reminder' | 'attendance_summary';

export interface CronJobConfig {
  target_type: 'chat_id' | 'open_id';
  target_id: string;
  reminder_minutes: number;
  course_name?: string;
  class_name?: string;
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

async function executeCronJob(env: Env, job: any): Promise<void> {
  const config: CronJobConfig = job.config ? JSON.parse(job.config) : {};

  // Get institution
  const institution = await getInstitutionById(env, job.institution_id);
  if (!institution || institution.status !== 'active') {
    console.log(`Institution ${job.institution_id} is not active, skipping job ${job.id}`);
    return;
  }

  const now = Date.now();
  const scheduleTime = parseScheduleTime(job.schedule);

  // Check if should run now
  if (!shouldRunNow(now, scheduleTime, job.job_type)) {
    return;
  }

  console.log(`Executing cron job ${job.id} of type ${job.job_type}`);

  if (job.job_type === 'class_reminder') {
    await executeClassReminder(env, job, institution, config);
  } else if (job.job_type === 'attendance_summary') {
    await executeAttendanceSummary(env, job, institution, config);
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

  const scheduleTableId = institution.bitable_schedule_table_id;
  if (!scheduleTableId) {
    console.log('Schedule table not configured');
    return;
  }

  // Calculate time range (next 30 minutes)
  const now = Date.now();
  const startTime = now;
  const endTime = now + 30 * 60 * 1000;

  // Get upcoming classes
  const scheduleRecords = await bitable.getScheduleByTime(
    bitableConfig,
    scheduleTableId,
    '上课时间', // time field name
    startTime,
    endTime
  );

  if (scheduleRecords.length === 0) {
    console.log('No upcoming classes found');
    return;
  }

  for (const record of scheduleRecords) {
    const fields = record.fields;
    const courseName = fields['课程'] || fields['course_name'] || '';
    const className = fields['班级'] || fields['class_name'] || '';
    const teacherName = fields['上课老师'] || fields['teacher_name'] || '';
    const scheduledTime = fields['上课时间'];
    const recordId = record.record_id;

    // Format scheduled time
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
      const cardResult = await sendAttendanceCard(
        {
          appId: institution.feishu_app_id,
          appSecret: institution.feishu_app_secret,
        },
        config.target_id,
        config.target_type as 'chat_id' | 'open_id',
        sessionId,
        recordId,
        courseName,
        className,
        teacherName,
        timeStr
      );

      console.log(`Sent attendance card for session ${sessionId}, message_id: ${cardResult.messageId}`);
    } catch (error) {
      console.error(`Failed to send attendance card:`, error);
    }
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

/**
 * Parse cron schedule to determine if should run
 * Simplified version - in production use a proper cron parser
 */
function parseScheduleTime(schedule: string): { hour: number; minute: number } {
  // Format: "0 9 * * *" = at 9:00 every day
  const parts = schedule.split(' ');
  if (parts.length < 5) {
    return { hour: 9, minute: 0 };
  }

  const minute = parseInt(parts[1], 10) || 0;
  const hour = parseInt(parts[2], 10) || 9;

  return { hour, minute };
}

function shouldRunNow(now: number, schedule: { hour: number; minute: number }, jobType: string): boolean {
  const date = new Date(now);
  const currentHour = date.getHours();
  const currentMinute = date.getMinutes();

  // For class_reminder, run every minute during business hours
  if (jobType === 'class_reminder') {
    return currentHour >= 7 && currentHour <= 21;
  }

  // For other jobs, check exact time
  return currentHour === schedule.hour && currentMinute === schedule.minute;
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

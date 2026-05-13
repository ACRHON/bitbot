/**
 * D1 Database Queries
 */

export interface Env {
  DB: D1Database;
  BITBOT_KV: KVNamespace;
}

export interface Institution {
  id: string;
  name: string;
  feishu_app_id: string;
  feishu_app_secret: string;
  feishu_verification_token: string | null;
  feishu_encrypt_key: string | null;
  bitable_base_id: string | null;
  bitable_student_table_id: string | null;
  bitable_sign_record_table_id: string | null;
  bitable_schedule_table_id: string | null;
  bitable_tables: string | null;
  created_at: number;
  expires_at: number;
  status: string;
  activation_code: string | null;
}

export interface AuthorizedUser {
  id: string;
  institution_id: string;
  feishu_open_id: string;
  feishu_name: string | null;
  role: string;
  created_at: number;
}

export interface CronJob {
  id: string;
  institution_id: string;
  job_type: string;
  schedule: string;
  enabled: number;
  config: string | null;
  created_at: number;
  last_run_at: number | null;
}

export interface AttendanceSession {
  id: string;
  institution_id: string;
  record_id: string;
  card_id: string | null;
  message_id: string | null;
  open_message_id: string | null;
  course_name: string | null;
  class_name: string | null;
  teacher_name: string | null;
  scheduled_time: number | null;
  status: string;
  created_at: number;
  completed_at: number | null;
}

// ============ Institutions ============

export async function getInstitutionByAppId(env: Env, appId: string): Promise<Institution | null> {
  const stmt = env.DB.prepare('SELECT * FROM institutions WHERE feishu_app_id = ?').bind(appId);
  const result = await stmt.first();
  return result as Institution | null;
}

export async function getInstitutionById(env: Env, id: string): Promise<Institution | null> {
  const stmt = env.DB.prepare('SELECT * FROM institutions WHERE id = ?').bind(id);
  const result = await stmt.first();
  return result as Institution | null;
}

export async function listInstitutions(env: Env): Promise<Institution[]> {
  const stmt = env.DB.prepare('SELECT * FROM institutions ORDER BY created_at DESC');
  const result = await stmt.all();
  return result.results as Institution[];
}

export async function createInstitution(env: Env, data: Omit<Institution, 'created_at'>): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    INSERT INTO institutions (id, name, feishu_app_id, feishu_app_secret,
      feishu_verification_token, feishu_encrypt_key, bitable_base_id,
      bitable_student_table_id, bitable_sign_record_table_id, bitable_schedule_table_id, bitable_tables,
      created_at, expires_at, status, activation_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.id, data.name, data.feishu_app_id, data.feishu_app_secret,
    data.feishu_verification_token, data.feishu_encrypt_key,
    data.bitable_base_id, data.bitable_student_table_id || null, data.bitable_sign_record_table_id || null, data.bitable_schedule_table_id || null, data.bitable_tables || null,
    now, data.expires_at, data.status, data.activation_code
  );
  await stmt.run();
}

export async function updateInstitution(env: Env, id: string, data: Partial<Institution>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key !== 'id' && key !== 'feishu_app_id') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;
  values.push(id);

  const sql = `UPDATE institutions SET ${fields.join(', ')} WHERE id = ?`;
  await env.DB.prepare(sql).bind(...values).run();
}

export async function deleteInstitution(env: Env, id: string): Promise<void> {
  // 先删除关联数据
  await env.DB.prepare('DELETE FROM authorized_users WHERE institution_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM cron_jobs WHERE institution_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM attendance_sessions WHERE institution_id = ?').bind(id).run();
  // 清除激活码的使用记录（保留审计历史）
  await env.DB.prepare('UPDATE activation_codes SET used_by = NULL WHERE used_by = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM institutions WHERE id = ?').bind(id).run();
}

// ============ Authorized Users ============

export async function getAuthorizedUser(env: Env, openId: string): Promise<AuthorizedUser | null> {
  const stmt = env.DB.prepare('SELECT * FROM authorized_users WHERE feishu_open_id = ?').bind(openId);
  const result = await stmt.first();
  return result as AuthorizedUser | null;
}

export async function listAuthorizedUsers(env: Env, institutionId: string): Promise<AuthorizedUser[]> {
  const stmt = env.DB.prepare('SELECT * FROM authorized_users WHERE institution_id = ?').bind(institutionId);
  const result = await stmt.all();
  return result.results as AuthorizedUser[];
}

export async function createAuthorizedUser(env: Env, data: Omit<AuthorizedUser, 'created_at'>): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    INSERT INTO authorized_users (id, institution_id, feishu_open_id, feishu_name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(data.id, data.institution_id, data.feishu_open_id, data.feishu_name, data.role, now);
  await stmt.run();
}

export async function deleteAuthorizedUser(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM authorized_users WHERE id = ?').bind(id).run();
}

// ============ Cron Jobs ============

export async function listCronJobs(env: Env, institutionId?: string): Promise<CronJob[]> {
  let stmt;
  if (institutionId) {
    stmt = env.DB.prepare('SELECT * FROM cron_jobs WHERE institution_id = ? ORDER BY created_at DESC').bind(institutionId);
  } else {
    stmt = env.DB.prepare('SELECT * FROM cron_jobs ORDER BY created_at DESC');
  }
  const result = await stmt.all();
  return result.results as CronJob[];
}

export async function getEnabledCronJobs(env: Env): Promise<CronJob[]> {
  const stmt = env.DB.prepare('SELECT * FROM cron_jobs WHERE enabled = 1');
  const result = await stmt.all();
  return result.results as CronJob[];
}

export async function createCronJob(env: Env, data: Omit<CronJob, 'created_at' | 'last_run_at'>): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    INSERT INTO cron_jobs (id, institution_id, job_type, schedule, enabled, config, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(data.id, data.institution_id, data.job_type, data.schedule, data.enabled, data.config, now);
  await stmt.run();
}

export async function updateCronJob(env: Env, id: string, data: Partial<CronJob>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key !== 'id') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;
  values.push(id);

  const stmt = env.DB.prepare(`UPDATE cron_jobs SET ${fields.join(', ')} WHERE id = ?`);
  await stmt.run(...values);
}

export async function deleteCronJob(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM cron_jobs WHERE id = ?').bind(id).run();
}

// ============ Attendance Sessions ============

export async function getAttendanceSession(env: Env, id: string): Promise<AttendanceSession | null> {
  const stmt = env.DB.prepare('SELECT * FROM attendance_sessions WHERE id = ?').bind(id);
  const result = await stmt.first();
  return result as AttendanceSession | null;
}

export async function getAttendanceSessionByMessage(env: Env, openMessageId: string): Promise<AttendanceSession | null> {
  const stmt = env.DB.prepare('SELECT * FROM attendance_sessions WHERE open_message_id = ?').bind(openMessageId);
  const result = await stmt.first();
  return result as AttendanceSession | null;
}

export async function listAttendanceSessions(env: Env, institutionId: string, status?: string): Promise<AttendanceSession[]> {
  let sql = 'SELECT * FROM attendance_sessions WHERE institution_id = ?';
  const bindings: any[] = [institutionId];

  if (status) {
    sql += ' AND status = ?';
    bindings.push(status);
  }

  sql += ' ORDER BY created_at DESC';
  const stmt = env.DB.prepare(sql).bind(...bindings);
  const result = await stmt.all();
  return result.results as AttendanceSession[];
}

export async function createAttendanceSession(env: Env, data: Omit<AttendanceSession, 'created_at' | 'completed_at'>): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    INSERT INTO attendance_sessions (id, institution_id, record_id, card_id, message_id, open_message_id,
      course_name, class_name, teacher_name, scheduled_time, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.id, data.institution_id, data.record_id, data.card_id, data.message_id,
    data.open_message_id, data.course_name, data.class_name, data.teacher_name,
    data.scheduled_time, data.status, now
  );
  await stmt.run();
}

export async function updateAttendanceSession(env: Env, id: string, data: Partial<AttendanceSession>): Promise<void> {
  const fields: string[] = [];
  const values: any[] = [];

  Object.entries(data).forEach(([key, value]) => {
    if (key !== 'id') {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });

  if (fields.length === 0) return;
  values.push(id);

  const stmt = env.DB.prepare(`UPDATE attendance_sessions SET ${fields.join(', ')} WHERE id = ?`);
  await stmt.run(...values);
}

// ============ Attendance Logs ============

export interface AttendanceLog {
  id: string;
  session_id: string;
  student_id: string;
  student_name: string | null;
  action: string;
  from_status: string | null;
  to_status: string;
  operator_id: string;
  operator_name: string | null;
  reason: string | null;
  created_at: number;
}

export async function createAttendanceLog(
  env: Env,
  data: Omit<AttendanceLog, 'created_at'>
): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    INSERT INTO attendance_logs (id, session_id, student_id, student_name, action, from_status, to_status, operator_id, operator_name, reason, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.id, data.session_id, data.student_id, data.student_name,
    data.action, data.from_status, data.to_status,
    data.operator_id, data.operator_name, data.reason, now
  );
  await stmt.run();
}

export async function listAttendanceLogs(
  env: Env,
  sessionId: string
): Promise<AttendanceLog[]> {
  const stmt = env.DB.prepare('SELECT * FROM attendance_logs WHERE session_id = ? ORDER BY created_at DESC').bind(sessionId);
  const result = await stmt.all();
  return result.results as AttendanceLog[];
}

// ============ Admin Users ============

export interface AdminUser {
  id: string;
  username: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: number;
  last_login_at: number | null;
}

export async function getAdminUserByUsername(env: Env, username: string): Promise<AdminUser | null> {
  const stmt = env.DB.prepare('SELECT * FROM admin_users WHERE username = ?').bind(username);
  const result = await stmt.first();
  return result as AdminUser | null;
}

export async function getAdminUserById(env: Env, id: string): Promise<AdminUser | null> {
  const stmt = env.DB.prepare('SELECT * FROM admin_users WHERE id = ?').bind(id);
  const result = await stmt.first();
  return result as AdminUser | null;
}

export async function createAdminUser(env: Env, data: Omit<AdminUser, 'last_login_at'>): Promise<void> {
  const stmt = env.DB.prepare(`
    INSERT INTO admin_users (id, username, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(data.id, data.username, data.password_hash, data.name, data.role, data.created_at);
  await stmt.run();
}

export async function updateAdminLastLogin(env: Env, id: string): Promise<void> {
  const stmt = env.DB.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').bind(Date.now(), id);
  await stmt.run();
}

export async function deleteAdminUser(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM admin_users WHERE id = ?').bind(id).run();
}

// ============ Statistics ============

export async function getStats(env: Env): Promise<{
  totalInstitutions: number;
  activeInstitutions: number;
  expiredInstitutions: number;
  expiringSoonInstitutions: number;
  totalAttendanceSessions: number;
}> {
  const now = Date.now();
  const thirtyDaysLater = now + 30 * 24 * 60 * 60 * 1000;

  const allInstitutions = await listInstitutions(env);

  const total = allInstitutions.length;
  const active = allInstitutions.filter(i => i.status === 'active').length;
  const expired = allInstitutions.filter(i => i.status === 'expired').length;
  const expiringSoon = allInstitutions.filter(i =>
    i.status === 'active' && i.expires_at < thirtyDaysLater
  ).length;

  const sessionsStmt = env.DB.prepare('SELECT COUNT(*) as count FROM attendance_sessions');
  const sessionsResult = await sessionsStmt.first() as { count: number };

return {
    totalInstitutions: total,
    activeInstitutions: active,
    expiredInstitutions: expired,
    expiringSoonInstitutions: expiringSoon,
    totalAttendanceSessions: sessionsResult?.count || 0,
  };
}

// ============ Activation Codes ============

export interface ActivationCode {
  id: string;
  code: string;
  duration_days: number;
  expires_at: number;
  used: number;
  used_by: string | null;
  used_at: number | null;
  created_at: number;
  batch_name: string | null;
  revoked: number;
  revoked_at: number | null;
  revoked_reason: string | null;
}

export async function createActivationCode(env: Env, data: Omit<ActivationCode, 'created_at' | 'used' | 'used_by' | 'used_at'>): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    INSERT INTO activation_codes (id, code, duration_days, expires_at, used, created_at, batch_name)
    VALUES (?, ?, ?, ?, 0, ?, ?)
  `).bind(data.id, data.code, data.duration_days, data.expires_at, now, data.batch_name || null);
  await stmt.run();
}

export async function getActivationCodeByCode(env: Env, code: string): Promise<ActivationCode | null> {
  const stmt = env.DB.prepare('SELECT * FROM activation_codes WHERE code = ?').bind(code);
  const result = await stmt.first();
  return result as ActivationCode | null;
}

export async function getActivationCodeById(env: Env, id: string): Promise<ActivationCode | null> {
  const stmt = env.DB.prepare('SELECT * FROM activation_codes WHERE id = ?').bind(id);
  const result = await stmt.first();
  return result as ActivationCode | null;
}

export async function listActivationCodes(env: Env, batchName?: string, status?: string): Promise<ActivationCode[]> {
  let sql = 'SELECT * FROM activation_codes WHERE 1=1';
  const bindings: any[] = [];

  if (batchName) {
    sql += ' AND batch_name = ?';
    bindings.push(batchName);
  }

  if (status === 'unused') {
    sql += ' AND used = 0 AND revoked = 0 AND expires_at > ?';
    bindings.push(Date.now());
  } else if (status === 'used') {
    sql += ' AND used = 1';
  } else if (status === 'expired') {
    sql += ' AND used = 0 AND revoked = 0 AND expires_at <= ?';
    bindings.push(Date.now());
  } else if (status === 'revoked') {
    sql += ' AND revoked = 1';
  }

  sql += ' ORDER BY created_at DESC';
  const stmt = env.DB.prepare(sql).bind(...bindings);
  const result = await stmt.all();
  return result.results as ActivationCode[];
}

export async function listBatches(env: Env): Promise<string[]> {
  const stmt = env.DB.prepare('SELECT DISTINCT batch_name FROM activation_codes WHERE batch_name IS NOT NULL ORDER BY created_at DESC');
  const result = await stmt.all();
  return result.results.map((r: any) => r.batch_name);
}

export async function useActivationCode(env: Env, id: string, institutionId: string): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    UPDATE activation_codes SET used = 1, used_by = ?, used_at = ? WHERE id = ?
  `).bind(institutionId, now, id);
  await stmt.run();
}

export async function revokeActivationCode(env: Env, id: string, reason: string): Promise<void> {
  const now = Date.now();
  const stmt = env.DB.prepare(`
    UPDATE activation_codes SET revoked = 1, revoked_at = ?, revoked_reason = ? WHERE id = ?
  `).bind(now, reason, id);
  await stmt.run();
}

export async function deleteActivationCode(env: Env, id: string): Promise<void> {
  await env.DB.prepare('DELETE FROM activation_codes WHERE id = ? AND used = 0 AND revoked = 0').bind(id).run();
}

export async function deleteActivationCodesByBatch(env: Env, batchName: string): Promise<number> {
  // Handle null batch_name (default batch)
  if (batchName === null) {
    const result = await env.DB.prepare(
      'DELETE FROM activation_codes WHERE batch_name IS NULL AND used = 0 AND revoked = 0'
    ).run();
    return result.meta.changes || 0;
  }
  const result = await env.DB.prepare(
    'DELETE FROM activation_codes WHERE batch_name = ? AND used = 0 AND revoked = 0'
  ).bind(batchName).run();
  return result.meta.changes || 0;
}

export async function deleteActivationCodesByBatchAll(env: Env, batchName: string): Promise<number> {
  // Handle null batch_name (default batch)
  if (batchName === null) {
    const result = await env.DB.prepare(
      'DELETE FROM activation_codes WHERE batch_name IS NULL'
    ).run();
    return result.meta.changes || 0;
  }
  const result = await env.DB.prepare(
    'DELETE FROM activation_codes WHERE batch_name = ?'
  ).bind(batchName).run();
  return result.meta.changes || 0;
}

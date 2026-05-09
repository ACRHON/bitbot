/**
 * API Client for bitbot Workers
 */

import { isDevMode, mockCheckAuth, mockGetSession, mockGetSessionStudents, mockGetSessionAbsences, mockSignStudent, mockMakeupSign, mockSearchStudents, mockAddTempStudent, mockUndoSign, mockGetAttendanceLogs, mockListCronJobs, mockGetStats } from './mock';

const API_BASE = import.meta.env.VITE_API_BASE || '';

// Dev mode check
const DEV_MODE = isDevMode;

// Types
export interface User {
  id: string;
  open_id: string;
  name: string;
  role: 'admin' | 'teacher';
  institution_id: string;
}

export interface Institution {
  id: string;
  name: string;
  feishu_app_id: string;
  feishu_app_secret?: string;
  feishu_verification_token?: string;
  feishu_encrypt_key?: string;
  bitable_base_id?: string;
  bitable_student_table_id?: string;
  bitable_sign_record_table_id?: string;
  created_at: number;
  expires_at: number;
  status: 'active' | 'suspended' | 'expired';
  activation_code?: string | null;
}

export interface AttendanceSession {
  id: string;
  institution_id: string;
  record_id: string;
  course_name: string;
  class_name: string;
  teacher_name: string;
  scheduled_time: number | null;
  status: 'active' | 'completed' | 'cancelled';
  created_at: number;
  completed_at: number | null;
}

export interface Student {
  record_id: string;
  name: string;
  status?: string;
  class_name?: string;
  [key: string]: any;
}

export interface CronJob {
  id: string;
  institution_id: string;
  institution_name?: string;
  job_type: string;
  schedule: string;
  enabled: number;
  config: string;
  last_run_at: number | null;
  created_at: number;
}

export interface Stats {
  totalInstitutions: number;
  activeInstitutions: number;
  expiredInstitutions: number;
  expiringSoonInstitutions: number;
  totalAttendanceSessions: number;
}

// API Functions
export async function checkAuth(openId: string): Promise<{
  authorized: boolean;
  user?: User;
  institution?: Institution;
  message?: string;
}> {
  if (DEV_MODE) {
    return mockCheckAuth(openId);
  }
  const res = await fetch(`${API_BASE}/api/auth/check?open_id=${encodeURIComponent(openId)}`);
  return res.json();
}

export async function getSession(sessionId: string): Promise<AttendanceSession> {
  if (DEV_MODE) {
    return mockGetSession(sessionId);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}`);
  if (!res.ok) throw new Error('Failed to get session');
  return res.json();
}

export async function signStudent(
  sessionId: string,
  studentName: string,
  studentRecordId: string,
  status: 'sign_in' | 'leave' | 'absent'
): Promise<{ success: boolean }> {
  if (DEV_MODE) {
    return mockSignStudent(sessionId, studentName, studentRecordId, status);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/sign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_name: studentName,
      student_record_id: studentRecordId,
      status,
    }),
  });
  return res.json();
}

export async function getSessionStudents(sessionId: string): Promise<{ students: Student[]; error?: string }> {
  if (DEV_MODE) {
    return mockGetSessionStudents(sessionId);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/students`);
  return res.json();
}

export async function getSessionAbsences(sessionId: string): Promise<{ absences: { record_id: string; name: string; course_name: string; class_name: string; scheduled_time: number | null }[]; error?: string }> {
  if (DEV_MODE) {
    return mockGetSessionAbsences(sessionId);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/absences`);
  return res.json();
}

export async function makeupSign(sessionId: string, studentRecordId: string, studentName: string): Promise<{ success: boolean }> {
  if (DEV_MODE) {
    return mockMakeupSign(sessionId, studentRecordId, studentName);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/makeup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ student_record_id: studentRecordId, student_name: studentName }),
  });
  return res.json();
}

export async function searchStudents(sessionId: string, keyword: string): Promise<{ students: Student[]; error?: string }> {
  if (DEV_MODE) {
    return mockSearchStudents(sessionId, keyword);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/search-students?keyword=${encodeURIComponent(keyword)}`);
  return res.json();
}

export async function addTempStudent(
  sessionId: string,
  studentRecordId: string,
  studentName: string,
  action: 'temp_makeup' | 'transfer_class',
  originalClass?: string
): Promise<{ success: boolean }> {
  if (DEV_MODE) {
    return mockAddTempStudent(sessionId, studentRecordId, studentName, action, originalClass);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/add-temp-student`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_record_id: studentRecordId,
      student_name: studentName,
      action,
      original_class: originalClass,
    }),
  });
  return res.json();
}

export async function undoSign(
  sessionId: string,
  studentRecordId: string,
  studentName: string,
  fromStatus: string,
  reason?: string
): Promise<{ success: boolean }> {
  if (DEV_MODE) {
    return mockUndoSign(sessionId, studentRecordId, studentName, fromStatus, reason);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/undo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_record_id: studentRecordId,
      student_name: studentName,
      from_status: fromStatus,
      reason,
    }),
  });
  return res.json();
}

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

export async function getAttendanceLogs(sessionId: string): Promise<{ logs: AttendanceLog[] }> {
  if (DEV_MODE) {
    return mockGetAttendanceLogs(sessionId);
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/logs`);
  return res.json();
}

export async function endSession(sessionId: string): Promise<{ success: boolean; completed_at?: number }> {
  if (DEV_MODE) {
    await delay(500);
    return { success: true, completed_at: Date.now() };
  }
  const res = await fetch(`${API_BASE}/api/attendance/${sessionId}/end`, {
    method: 'POST',
  });
  return res.json();
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Admin API functions
export async function listInstitutions(): Promise<Institution[]> {
  const res = await fetch(`${API_BASE}/api/admin/institutions`);
  return res.json();
}

export async function createInstitution(data: Partial<Institution>): Promise<Institution> {
  const res = await fetch(`${API_BASE}/api/admin/institutions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateInstitution(id: string, data: Partial<Institution>): Promise<Institution> {
  const res = await fetch(`${API_BASE}/api/admin/institutions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteInstitution(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/admin/institutions/${id}`, {
    method: 'DELETE',
  });
}

// Auth
export async function listAuthUsers(institutionId: string): Promise<User[]> {
  const res = await fetch(`${API_BASE}/api/auth/users?institution_id=${institutionId}`);
  return res.json();
}

export async function addAuthUser(
  institutionId: string,
  openId: string,
  name: string
): Promise<void> {
  await fetch(`${API_BASE}/api/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      institution_id: institutionId,
      feishu_open_id: openId,
      feishu_name: name,
    }),
  });
}

export async function removeAuthUser(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/auth/users/${id}`, {
    method: 'DELETE',
  });
}

// Attendance Records
export interface AttendanceRecord {
  record_id: string;
  institution_id: string;
  institution_name: string;
  student_name: string;
  course_name: string;
  class_name: string;
  scheduled_time: number | null;
  sign_status: string;
  sign_method: string;
}

export async function listAttendanceRecords(filters: {
  institution_id?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  keyword?: string;
}): Promise<{ records: AttendanceRecord[] }> {
  if (DEV_MODE) {
    await delay(300);
    return {
      records: [
        {
          record_id: '1',
          institution_id: 'inst_001',
          institution_name: '测试校区',
          student_name: '张三',
          course_name: '美术',
          class_name: '美术1班',
          scheduled_time: Date.now() - 3600000,
          sign_status: '已到',
          sign_method: 'H5点名',
        },
        {
          record_id: '2',
          institution_id: 'inst_001',
          institution_name: '测试校区',
          student_name: '李四',
          course_name: '美术',
          class_name: '美术1班',
          scheduled_time: Date.now() - 3600000,
          sign_status: '请假',
          sign_method: 'H5点名',
        },
      ],
    };
  }
  const params = new URLSearchParams();
  if (filters.institution_id) params.set('institution_id', filters.institution_id);
  if (filters.date_from) params.set('date_from', filters.date_from);
  if (filters.date_to) params.set('date_to', filters.date_to);
  if (filters.status) params.set('status', filters.status);
  if (filters.keyword) params.set('keyword', filters.keyword);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/admin/attendance/records${query}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

// Students
export interface StudentRecord {
  record_id: string;
  institution_id: string;
  institution_name: string;
  name: string;
  phone: string;
  parent_phone: string;
  class_name: string;
  created_at: number | null;
}

export async function listStudentsAdmin(filters: {
  institution_id?: string;
  keyword?: string;
}): Promise<{ students: StudentRecord[] }> {
  if (DEV_MODE) {
    await delay(300);
    return {
      students: [
        {
          record_id: '1',
          institution_id: 'inst_001',
          institution_name: '测试校区',
          name: '张三',
          phone: '13800138001',
          parent_phone: '13900139001',
          class_name: '美术1班',
          created_at: Date.now() - 30 * 24 * 3600000,
        },
        {
          record_id: '2',
          institution_id: 'inst_001',
          institution_name: '测试校区',
          name: '李四',
          phone: '13800138002',
          parent_phone: '13900139002',
          class_name: '美术1班',
          created_at: Date.now() - 60 * 24 * 3600000,
        },
      ],
    };
  }
  const params = new URLSearchParams();
  if (filters.institution_id) params.set('institution_id', filters.institution_id);
  if (filters.keyword) params.set('keyword', filters.keyword);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/api/admin/students${query}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

// Cron Jobs
export async function listCronJobs(): Promise<CronJob[]> {
  if (DEV_MODE) {
    return mockListCronJobs();
  }
  const res = await fetch(`${API_BASE}/api/admin/cron`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

export async function createCronJob(data: {
  institution_id: string;
  job_type: string;
  schedule: string;
  enabled?: boolean;
  config?: string;
}): Promise<{ id: string; success: boolean }> {
  const res = await fetch(`${API_BASE}/api/admin/cron`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create cron job');
  return res.json();
}

export async function updateCronJob(id: string, data: Partial<CronJob>): Promise<void> {
  await fetch(`${API_BASE}/api/admin/cron/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
    },
    body: JSON.stringify(data),
  });
}

export async function deleteCronJob(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/admin/cron/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
}

// Stats
export async function getStats(): Promise<Stats> {
  if (DEV_MODE) {
    return mockGetStats();
  }
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

// Activation Codes
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

export async function batchGenerateActivationCode(count: number, durationDays: number, batchName?: string): Promise<{ count: number; codes: ActivationCode[] }> {
  const res = await fetch(`${API_BASE}/api/admin/activation/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
    },
    body: JSON.stringify({ count, duration_days: durationDays, batch_name: batchName }),
  });
  if (!res.ok) throw new Error('Failed to generate activation codes');
  return res.json();
}

export async function listActivationCodes(batch?: string, status?: string): Promise<ActivationCode[]> {
  let url = `${API_BASE}/api/admin/activation/codes`;
  const params = new URLSearchParams();
  if (batch) params.set('batch', batch);
  if (status) params.set('status', status);
  if (params.toString()) url += '?' + params.toString();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

export async function listActivationBatches(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/admin/activation/batches`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

export async function revokeActivationCode(id: string, reason?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/admin/activation/codes/${id}/revoke`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('admin_token')}`,
    },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Failed to revoke activation code');
}

export async function deleteActivationCode(id: string): Promise<void> {
  await fetch(`${API_BASE}/api/admin/activation/codes/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
}

export async function deleteActivationCodeBatch(batchName: string, force: boolean = false): Promise<{ success: boolean; deleted: number }> {
  const res = await fetch(`${API_BASE}/api/admin/activation/batch/${encodeURIComponent(batchName)}?force=${force}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

export interface ActivationCodeValidation {
  valid: boolean;
  error?: string;
  duration_days?: number;
  expires_at?: number;
  batch_name?: string | null;
}

export async function validateActivationCode(code: string): Promise<ActivationCodeValidation> {
  const res = await fetch(`${API_BASE}/api/admin/activation/validate?code=${encodeURIComponent(code)}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` },
  });
  return res.json();
}

// Campus Management APIs
export interface CampusData {
  students: Student[];
  courses: Course[];
  classes: Class[];
}

export interface Course {
  record_id: string;
  name: string;
  description?: string;
}

export interface Class {
  record_id: string;
  name: string;
  course_name?: string;
  teacher_name?: string;
}

export async function getCampusData(institutionId: string): Promise<CampusData> {
  const res = await fetch(`${API_BASE}/api/campus/${institutionId}/data`);
  return res.json();
}

export async function getStudents(institutionId: string): Promise<Student[]> {
  const res = await fetch(`${API_BASE}/api/campus/${institutionId}/students`);
  return res.json();
}

export async function createStudent(institutionId: string, fields: Record<string, any>): Promise<{ record_id: string }> {
  const res = await fetch(`${API_BASE}/api/campus/${institutionId}/students`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  return res.json();
}

export async function updateStudent(institutionId: string, recordId: string, fields: Record<string, any>): Promise<void> {
  await fetch(`${API_BASE}/api/campus/${institutionId}/students/${recordId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

export async function getCourses(institutionId: string): Promise<Course[]> {
  const res = await fetch(`${API_BASE}/api/campus/${institutionId}/courses`);
  return res.json();
}

export async function getClasses(institutionId: string): Promise<Class[]> {
  const res = await fetch(`${API_BASE}/api/campus/${institutionId}/classes`);
  return res.json();
}

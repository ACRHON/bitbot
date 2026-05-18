/**
 * Mock Data for Development Mode
 * Used when VITE_DEV_MODE=true
 */

import type { Institution, User, AttendanceSession, Student, CronJob } from './api';

// Check if we're in dev mode
export const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

console.log('[Mock] Development mode:', isDevMode);

// ============ Mock Data ============

export const mockUser: User = {
  id: 'user_001',
  open_id: 'mock_open_id',
  name: '张三老师',
  role: 'teacher',
  institution_id: 'inst_001',
};

export const mockInstitution: Institution = {
  id: 'inst_001',
  name: '测试校区',
  feishu_app_id: 'cli_xxxxxxxxx',
  feishu_app_secret: 'mock_secret',
  feishu_verification_token: 'mock_token',
  feishu_encrypt_key: 'mock_key',
  bitable_base_id: 'mock_base_id',
  bitable_student_table_id: 'mock_student_table',
  bitable_sign_record_table_id: 'mock_sign_table',
  created_at: Date.now() - 90 * 24 * 60 * 60 * 1000,
  expires_at: Date.now() + 365 * 24 * 60 * 60 * 1000,
  status: 'active',
  activation_code: null,
};

export const mockSession: AttendanceSession = {
  id: 'sess_001',
  institution_id: 'inst_001',
  record_id: 'rec_001',
  course_name: '美术',
  class_name: '美术1班',
  teacher_name: '王老师',
  scheduled_time: Date.now(),
  status: 'active',
  created_at: Date.now() - 60 * 60 * 1000,
  completed_at: null,
};

export const mockStudents: Student[] = [
  { record_id: 'stu_001', name: '张三', status: undefined },
  { record_id: 'stu_002', name: '李四', status: undefined },
  { record_id: 'stu_003', name: '王五', status: undefined },
  { record_id: 'stu_004', name: '赵六', status: undefined },
  { record_id: 'stu_005', name: '钱七', status: undefined },
];

export const mockCronJobs: CronJob[] = [
  {
    id: 'cron_001',
    institution_id: 'inst_001',
    institution_name: '测试校区',
    job_type: 'class_reminder',
    schedule: '0 9 * * *',
    enabled: 1,
    config: '{"reminderMinutes":30}',
    last_run_at: Date.now() - 2 * 60 * 60 * 1000,
    created_at: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
];

// ============ Mock API Functions ============

export async function mockCheckAuth(_openId: string) {
  await delay(300);
  return {
    authorized: true,
    user: mockUser,
    institution: mockInstitution,
  };
}

export async function mockGetSession(_sessionId: string) {
  await delay(200);
  return { ...mockSession, id: 'dev_session' };
}

export async function mockGetSessionStudents(_sessionId: string) {
  await delay(300);
  // Simulate some students already signed
  const students = mockStudents.map(s => ({
    ...s,
    status: Math.random() > 0.7 ? 'sign_in' : undefined,
  }));
  return { students, makeupStudents: [] };
}

export async function mockGetSessionAbsences(_sessionId: string) {
  await delay(200);
  return {
    absences: [
      { record_id: 'stu_003', name: '王五', course_name: '美术', class_name: '美术1班', scheduled_time: Date.now() },
      { record_id: 'stu_005', name: '钱七', course_name: '美术', class_name: '美术1班', scheduled_time: Date.now() },
    ],
  };
}

export async function mockSignStudent(
  _sessionId: string,
  studentName: string,
  studentRecordId: string,
  status: 'sign_in' | 'leave' | 'absent'
) {
  await delay(400);
  console.log(`[Mock] Sign: ${studentName} (${studentRecordId}) -> ${status}`);
  return { success: true };
}

export async function mockMakeupSign(_sessionId: string, studentRecordId: string, studentName: string) {
  await delay(400);
  console.log(`[Mock] Makeup sign: ${studentName} (${studentRecordId})`);
  return { success: true };
}

export async function mockSearchStudents(_sessionId: string, keyword: string) {
  await delay(300);
  const filtered = mockStudents.filter(s =>
    s.name.toLowerCase().includes(keyword.toLowerCase())
  );
  return { students: filtered };
}

export async function mockAddTempStudent(
  _sessionId: string,
  studentRecordId: string,
  studentName: string,
  action: 'temp_makeup' | 'transfer_class',
  _originalClass?: string
) {
  await delay(400);
  console.log(`[Mock] Add temp student: ${studentName} (${studentRecordId}) - action: ${action}`);
  return { success: true };
}

export async function mockUndoSign(
  _sessionId: string,
  studentRecordId: string,
  studentName: string,
  _fromStatus: string,
  reason?: string
) {
  await delay(400);
  console.log(`[Mock] Undo sign: ${studentName} (${studentRecordId}) - reason: ${reason}`);
  return { success: true };
}

export async function mockGetAttendanceLogs(_sessionId: string) {
  await delay(200);
  return {
    logs: [
      {
        id: 'log_001',
        session_id: 'sess_001',
        student_id: 'stu_001',
        student_name: '张三',
        action: 'sign_in',
        from_status: 'pending',
        to_status: 'sign_in',
        operator_id: 'system',
        operator_name: null,
        reason: null,
        created_at: Date.now() - 300000,
      },
      {
        id: 'log_002',
        session_id: 'sess_001',
        student_id: 'stu_002',
        student_name: '李四',
        action: 'leave',
        from_status: 'pending',
        to_status: 'leave',
        operator_id: 'system',
        operator_name: null,
        reason: null,
        created_at: Date.now() - 240000,
      },
    ],
  };
}

export async function mockListCronJobs() {
  await delay(300);
  return mockCronJobs;
}

export async function mockGetStats() {
  await delay(200);
  return {
    totalInstitutions: 5,
    activeInstitutions: 4,
    expiredInstitutions: 0,
    expiringSoonInstitutions: 1,
    totalAttendanceSessions: 128,
  };
}

// ============ Utility ============

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Store for demo data in memory
export const mockDataStore = {
  students: [...mockStudents],
  cronJobs: [...mockCronJobs],
  sessions: [mockSession],
};

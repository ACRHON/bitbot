-- bitbot D1 Database Schema
-- Run: wrangler d1 execute bitbot-db --local --file=./src/db/schema.sql

-- 机构表
CREATE TABLE IF NOT EXISTS institutions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  feishu_app_id TEXT NOT NULL UNIQUE,
  feishu_app_secret TEXT NOT NULL,
  feishu_verification_token TEXT,
  feishu_encrypt_key TEXT,
  bitable_base_id TEXT,
  bitable_student_table_id TEXT,
  bitable_sign_record_table_id TEXT,
  bitable_schedule_table_id TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'expired')),
  activation_code TEXT
);

-- 授权用户表
CREATE TABLE IF NOT EXISTS authorized_users (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  feishu_open_id TEXT NOT NULL,
  feishu_name TEXT,
  role TEXT DEFAULT 'teacher' CHECK(role IN ('admin', 'teacher')),
  created_at INTEGER NOT NULL,
  UNIQUE(institution_id, feishu_open_id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- 定时任务配置表
CREATE TABLE IF NOT EXISTS cron_jobs (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  job_type TEXT NOT NULL,
  schedule TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  config TEXT,
  created_at INTEGER NOT NULL,
  last_run_at INTEGER,
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- 点名会话表
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id TEXT PRIMARY KEY,
  institution_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  card_id TEXT,
  message_id TEXT,
  open_message_id TEXT,
  course_name TEXT,
  class_name TEXT,
  teacher_name TEXT,
  scheduled_time INTEGER,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (institution_id) REFERENCES institutions(id)
);

-- 考勤操作日志表
CREATE TABLE IF NOT EXISTS attendance_logs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  student_name TEXT,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  operator_id TEXT NOT NULL,
  operator_name TEXT,
  reason TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id)
);

-- 管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'super_admin')),
  created_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  duration_days INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  used_by TEXT,
  used_at INTEGER,
  created_at INTEGER NOT NULL,
  batch_name TEXT,
  revoked INTEGER DEFAULT 0,
  revoked_at INTEGER,
  revoked_reason TEXT
);

-- 机构表添加激活码字段
-- ALTER TABLE institutions ADD COLUMN activation_code TEXT;

-- 索引
CREATE INDEX IF NOT EXISTS idx_institutions_app_id ON institutions(feishu_app_id);
CREATE INDEX IF NOT EXISTS idx_authorized_users_openid ON authorized_users(feishu_open_id);
CREATE INDEX IF NOT EXISTS idx_cron_jobs_institution ON cron_jobs(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_institution ON attendance_sessions(institution_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_record ON attendance_sessions(record_id);
CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON activation_codes(code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_batch ON activation_codes(batch_name);
CREATE INDEX IF NOT EXISTS idx_activation_codes_used ON activation_codes(used);
CREATE INDEX IF NOT EXISTS idx_activation_codes_used ON activation_codes(used);

/**
 * Dev Home Page
 * Landing page for development mode - allows direct access to all pages with mock data
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { isDevMode } from '../lib/mock';

const DevHome: React.FC = () => {
  if (!isDevMode) {
    // In production, redirect to dashboard
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ color: 'var(--danger-color)' }}>生产模式</h2>
          <p>开发工具仅在开发模式下可用</p>
          <Link to="/dashboard" className="btn btn-primary">
            前往控制台
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <div className="flex flex-between">
          <h1 className="page-title">🛠️ 开发模式</h1>
          <span className="badge badge-success">开发中</span>
        </div>
      </div>

      <div className="card mb-16">
        <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          当前使用 Mock 数据，无需后端即可预览所有页面
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {/* User-facing pages */}
          <div className="card" style={{ padding: '16px' }}>
            <h4 style={{ marginBottom: '12px' }}>👤 用户页面</h4>
            <div className="flex flex-col gap-8">
              <Link to="/dashboard" className="btn btn-primary">
                📊 控制台
              </Link>
              <Link to="/attendance?sess=demo" className="btn btn-secondary">
                🎯 点名签到
              </Link>
              <Link to="/makeup?sess=demo" className="btn btn-secondary">
                📋 补签管理
              </Link>
              <Link to="/campus" className="btn btn-secondary">
                🏫 校区管理
              </Link>
              <Link to="/robot-status" className="btn btn-secondary">
                🤖 机器人状态
              </Link>
              <Link to="/cron-jobs" className="btn btn-secondary">
                ⏰ 定时任务
              </Link>
            </div>
          </div>

          {/* Admin pages */}
          <div className="card" style={{ padding: '16px' }}>
            <h4 style={{ marginBottom: '12px' }}>⚙️ 管理后台</h4>
            <div className="flex flex-col gap-8">
              <Link to="/admin" className="btn btn-secondary">
                📈 管理概览
              </Link>
              <Link to="/admin/institutions" className="btn btn-secondary">
                🏢 机构管理
              </Link>
              <Link to="/admin/activation" className="btn btn-secondary">
                🔑 激活码管理
              </Link>
              <Link to="/admin/cron" className="btn btn-secondary">
                ⏰ 定时任务
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Mock Data Info */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          📋 Mock 数据说明
        </h3>
        <div className="list-item">
          <span>校区名称</span>
          <span>测试校区</span>
        </div>
        <div className="list-item">
          <span>用户</span>
          <span>张三老师</span>
        </div>
        <div className="list-item">
          <span>课程</span>
          <span>美术1班</span>
        </div>
        <div className="list-item">
          <span>学员</span>
          <span>张三、李四、王五、赵六、钱七</span>
        </div>
        <div className="list-item">
          <span>模拟状态</span>
          <span>部分学员已签到（随机）</span>
        </div>
      </div>
    </div>
  );
};

export default DevHome;

/**
 * Dashboard Page
 * Main entry page showing campus status
 */

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { checkAuth, Institution, User } from '../lib/api';

const Dashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Get open_id from URL params (passed from Feishu card click)
        const urlParams = new URLSearchParams(window.location.search);
        const openId = urlParams.get('open_id') || 'demo_user';

        const result = await checkAuth(openId);

        if (!result.authorized) {
          setError(result.message || '未授权');
        } else {
          setInstitution(result.institution || null);
          setUser(result.user || null);
        }
      } catch (err) {
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="empty-state">
            <p className="text-danger">{error}</p>
            <p className="text-secondary">请联系平台管理员开通权限</p>
          </div>
        </div>
      </div>
    );
  }

  const isExpiringSoon = institution && institution.expires_at
    ? institution.expires_at - Date.now() < 30 * 24 * 60 * 60 * 1000
    : false;

  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">控制台</h1>
      </div>

      {/* Campus Info Card */}
      <div className="card">
        <div className="flex flex-between mb-16">
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
              {institution?.name || '校区'}
            </h2>
            <span className={`badge ${institution?.status === 'active' ? 'badge-success' : 'badge-danger'}`}>
              {institution?.status === 'active' ? '运行中' : '已停用'}
            </span>
          </div>
        </div>

        {/* Expiry Warning */}
        {isExpiringSoon && (
          <div style={{
            padding: '12px',
            background: 'rgba(255, 125, 0, 0.1)',
            borderRadius: '6px',
            marginBottom: '16px',
          }}>
            <span className="text-warning">
              ⚠️ 授权即将到期，请联系平台续费
            </span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <Link to="/attendance" className="btn btn-primary">
            🎯 点名签到
          </Link>
          <Link to="/makeup" className="btn btn-secondary">
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

      {/* Today's Classes */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          📅 今日课表
        </h3>
        <div className="empty-state">
          <p className="text-secondary">暂无课程信息</p>
        </div>
      </div>

      {/* User Info */}
      {user && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
            👤 用户信息
          </h3>
          <div className="list-item">
            <span>姓名</span>
            <span>{user.name || '未知'}</span>
          </div>
          <div className="list-item">
            <span>角色</span>
            <span>{user.role === 'admin' ? '管理员' : '老师'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;

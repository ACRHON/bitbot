/**
 * Admin Layout
 */

import React, { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin', label: '首页', icon: '📊' },
    { path: '/admin/institutions', label: '机构管理', icon: '🏢' },
    { path: '/admin/activation', label: '激活码', icon: '🔑' },
    { path: '/admin/cron', label: '定时任务', icon: '⏰' },
    { path: '/admin/attendance-summary', label: '考勤记录', icon: '📋' },
    { path: '/admin/students', label: '学员管理', icon: '👨‍🎓' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px',
        background: '#fff',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <Link to="/admin" style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--primary-color)',
            textDecoration: 'none',
          }}>
            bitbot
          </Link>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            管理后台
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '8px' }}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 12px',
                borderRadius: '6px',
                textDecoration: 'none',
                color: location.pathname === item.path ? 'var(--primary-color)' : 'var(--text-color)',
                background: location.pathname === item.path ? 'rgba(51, 112, 255, 0.1)' : 'transparent',
                fontWeight: location.pathname === item.path ? 600 : 400,
                marginBottom: '4px',
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
            {user?.name || user?.username}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            {user?.role === 'super_admin' ? '超级管理员' : '管理员'}
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ width: '100%' }}>
            退出登录
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;

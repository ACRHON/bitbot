/**
 * Admin Dashboard Page
 * Shows statistics and overview
 */

import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useNavigate } from 'react-router-dom';

interface Stats {
  totalInstitutions: number;
  activeInstitutions: number;
  expiredInstitutions: number;
  expiringSoonInstitutions: number;
  totalAttendanceSessions: number;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

const AdminDashboard: React.FC = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [token]);

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  const statCards = [
    { label: '总机构数', value: stats?.totalInstitutions || 0, color: 'var(--primary-color)' },
    { label: '运行中', value: stats?.activeInstitutions || 0, color: 'var(--success-color)' },
    { label: '已到期', value: stats?.expiredInstitutions || 0, color: 'var(--danger-color)' },
    { label: '即将到期', value: stats?.expiringSoonInstitutions || 0, color: 'var(--warning-color)' },
    { label: '点名会话', value: stats?.totalAttendanceSessions || 0, color: '#722ed1' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">控制台</h1>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        {statCards.map((stat, index) => (
          <div key={index} className="card" style={{
            borderLeft: `4px solid ${stat.color}`,
          }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '28px', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Expiring Soon Alert */}
      {stats && stats.expiringSoonInstitutions > 0 && (
        <div className="card" style={{
          background: 'rgba(255, 125, 0, 0.1)',
          border: '1px solid var(--warning-color)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span>
            <span style={{ fontWeight: 500 }}>
              有 {stats.expiringSoonInstitutions} 个机构授权即将到期
            </span>
          </div>
          <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
            请及时联系机构负责人续费
          </div>
        </div>
      )}

      {/* Webhook URL Card */}
      <div className="card" style={{
        background: 'rgba(51, 112, 255, 0.05)',
        border: '1px solid var(--primary-color)',
        marginBottom: '24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '20px' }}>🔗</span>
          <span style={{ fontWeight: 600 }}>飞书 Webhook 网址</span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#fff',
          padding: '8px 12px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
        }}>
          <code style={{ flex: 1, fontSize: '14px', color: 'var(--text-color)' }}>
            https://fastbot.de5.net/webhook/feishu
          </code>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              navigator.clipboard.writeText('https://fastbot.de5.net/webhook/feishu');
              alert('已复制到剪贴板');
            }}
          >
            复制
          </button>
        </div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          复制上方链接，填写到飞书开放平台的「事件与回调 → 订阅方式 → HTTP 回调」中
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>
          快捷操作
        </h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/institutions')}>
            + 添加机构
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/institutions')}>
            查看所有机构
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/attendance-summary')}>
            考勤记录
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/students')}>
            学员管理
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

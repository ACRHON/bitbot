/**
 * Robot Status Page
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface RobotStatus {
  online: boolean;
  lastActivity: number;
  version: string;
  env?: string;
}

const RobotStatus: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<RobotStatus>({
    online: false,
    lastActivity: 0,
    version: '1.0.0',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE || '';
        const res = await fetch(`${apiBase}/api/robot/status`);
        const data = await res.json();
        setStatus(data);
      } catch (err) {
        console.error('Failed to load robot status:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStatus();
  }, []);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '从未运行';
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div className="container">
      <div className="page-header">
        <div className="flex flex-between flex-center">
          <h1 className="page-title">机器人状态</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            ← 返回
          </button>
        </div>
      </div>

      <div className="card">
        <div className="list-item">
          <span>连接状态</span>
          <span className={status.online ? 'text-success' : 'text-danger'}>
            {status.online ? '🟢 在线' : '🔴 离线'}
          </span>
        </div>
        <div className="list-item">
          <span>最后活动</span>
          <span>{formatTime(status.lastActivity)}</span>
        </div>
        <div className="list-item">
          <span>版本</span>
          <span>{status.version}</span>
        </div>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          📊 运行状态
        </h3>
        <div className="empty-state">
          <p className="text-secondary">暂无统计数据</p>
        </div>
      </div>
    </div>
  );
};

export default RobotStatus;

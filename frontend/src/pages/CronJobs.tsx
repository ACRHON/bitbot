/**
 * Cron Jobs Management Page
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCronJobs, updateCronJob } from '../lib/api';

interface CronJob {
  id: string;
  job_type: string;
  schedule: string;
  enabled: number;
  last_run_at: number | null;
}

const CronJobs: React.FC = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      try {
        const data = await listCronJobs();
        setJobs(data);
      } catch (err) {
        console.error('Failed to load cron jobs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadJobs();
  }, []);

  const handleToggle = async (job: CronJob) => {
    try {
      await updateCronJob(job.id, { enabled: job.enabled ? 0 : 1 });
      setJobs(prev => prev.map(j =>
        j.id === job.id ? { ...j, enabled: j.enabled ? 0 : 1 } : j
      ));
    } catch (err) {
      alert('操作失败');
    }
  };

  const formatLastRun = (timestamp: number | null) => {
    if (!timestamp) return '从未运行';
    return new Date(timestamp).toLocaleString('zh-CN');
  };

  const getJobTypeName = (type: string) => {
    switch (type) {
      case 'class_reminder': return '📚 课前提醒';
      default: return type;
    }
  };

  return (
    <div className="container">
      <div className="page-header">
        <div className="flex flex-between flex-center">
          <h1 className="page-title">定时任务</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            ← 返回
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-between mb-16">
          <h3 style={{ fontSize: '16px', fontWeight: 600 }}>任务列表</h3>
          <button className="btn btn-primary">
            + 添加任务
          </button>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无定时任务</p>
            <p className="text-secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
              定时任务由平台管理员配置
            </p>
          </div>
        ) : (
          jobs.map(job => (
            <div key={job.id} className="list-item">
              <div>
                <div style={{ fontWeight: 500 }}>{getJobTypeName(job.job_type)}</div>
                <div className="text-secondary" style={{ fontSize: '12px' }}>
                  上次运行: {formatLastRun(job.last_run_at)}
                </div>
              </div>
              <div className="flex gap-8 flex-center">
                <span className={`badge ${job.enabled ? 'badge-success' : 'badge-warning'}`}>
                  {job.enabled ? '已启用' : '已停用'}
                </span>
                <button className="btn btn-secondary" style={{ padding: '4px 8px' }} onClick={() => handleToggle(job)}>
                  {job.enabled ? '停用' : '启用'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          💡 预设模板
        </h3>
        <div className="empty-state">
          <p className="text-secondary">课前15分钟自动发送点名卡片</p>
          <p className="text-secondary">下课时间发送考勤汇总</p>
        </div>
      </div>
    </div>
  );
};

export default CronJobs;

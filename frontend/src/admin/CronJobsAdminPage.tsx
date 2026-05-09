/**
 * Cron Jobs Admin Page
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { CronJob, Institution, listInstitutions, createCronJob } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const CronJobsAdminPage: React.FC = () => {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [formData, setFormData] = useState({
    institution_id: '',
    job_type: 'class_reminder',
    schedule: '0 9 * * *',
    enabled: true,
    config: '',
  });

  useEffect(() => {
    fetchJobs();
    fetchInstitutions();
  }, []);

  const fetchInstitutions = async () => {
    try {
      const data = await listInstitutions();
      setInstitutions(data);
    } catch (err) {
      console.error('Failed to fetch institutions:', err);
    }
  };

  const handleCreate = async () => {
    if (!formData.institution_id || !formData.job_type || !formData.schedule) {
      alert('请填写必填字段');
      return;
    }
    setCreating(true);
    try {
      await createCronJob(formData);
      setShowCreate(false);
      setFormData({ institution_id: '', job_type: 'class_reminder', schedule: '0 9 * * *', enabled: true, config: '' });
      fetchJobs();
      alert('创建成功');
    } catch (err) {
      alert('创建失败');
    } finally {
      setCreating(false);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/cron`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setJobs(data);
      }
    } catch (err) {
      console.error('Failed to fetch cron jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleJob = async (id: string, enabled: number) => {
    try {
      await fetch(`${API_BASE}/api/admin/cron/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
      });
      fetchJobs();
    } catch (err) {
      console.error('Failed to toggle cron job:', err);
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('确定要删除该定时任务吗？')) return;
    try {
      await fetch(`${API_BASE}/api/admin/cron/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchJobs();
    } catch (err) {
      console.error('Failed to delete cron job:', err);
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
    <div>
      <div className="page-header flex flex-between">
        <h1 className="page-title">定时任务</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          创建任务
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : jobs.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无定时任务</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>任务类型</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>机构</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>上次运行</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                    {getJobTypeName(job.job_type)}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px' }}>
                    {job.institution_name || job.institution_id.substring(0, 8) + '...'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${job.enabled ? 'badge-success' : 'badge-warning'}`}>
                      {job.enabled ? '已启用' : '已停用'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {formatLastRun(job.last_run_at)}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', marginRight: '4px' }}
                      onClick={() => toggleJob(job.id, job.enabled)}
                    >
                      {job.enabled ? '停用' : '启用'}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 8px' }}
                      onClick={() => deleteJob(job.id)}
                    >
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              创建定时任务
            </h2>
            <div className="form-group">
              <label className="form-label">机构 *</label>
              <select
                className="input"
                value={formData.institution_id}
                onChange={e => setFormData({ ...formData, institution_id: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="">请选择机构</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">任务类型 *</label>
              <select
                className="input"
                value={formData.job_type}
                onChange={e => setFormData({ ...formData, job_type: e.target.value })}
                style={{ width: '100%' }}
              >
                <option value="class_reminder">📚 课前提醒</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Cron 表达式 *</label>
              <input
                type="text"
                className="input"
                value={formData.schedule}
                onChange={e => setFormData({ ...formData, schedule: e.target.value })}
                placeholder="例如: 0 9 * * *"
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                格式: 分 时 日 月 周 (例如: 0 9 * * * 表示每天9:00)
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">配置 (可选)</label>
              <input
                type="text"
                className="input"
                value={formData.config}
                onChange={e => setFormData({ ...formData, config: e.target.value })}
                placeholder="JSON 格式"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={e => setFormData({ ...formData, enabled: e.target.checked })}
                />
                创建后立即启用
              </label>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                {creating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CronJobsAdminPage;

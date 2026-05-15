/**
 * Schedule Management Admin Page
 * View and manage course schedules from Bitable
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { Institution, syncSchedules, getScheduleStatus, ScheduleStatusItem } from '../lib/api';

const ScheduleManagementPage: React.FC = () => {
  const { token } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleStatusItem[]>([]);
  const [totalCronJobs, setTotalCronJobs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    if (selectedInstitution) {
      loadSchedules();
    } else {
      setSchedules([]);
    }
  }, [selectedInstitution]);

  const fetchInstitutions = async () => {
    try {
      const res = await fetch(`/api/admin/institutions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data);
        if (data.length > 0 && !selectedInstitution) {
          setSelectedInstitution(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch institutions:', err);
    }
  };

  const loadSchedules = async () => {
    if (!selectedInstitution) return;
    setLoading(true);
    setError(null);
    setSyncResult(null);

    try {
      const result = await getScheduleStatus(selectedInstitution);
      setSchedules(result.schedules || []);
      setTotalCronJobs(result.total_cron_jobs || 0);
    } catch (err: any) {
      console.error('Failed to fetch schedules:', err);
      setError(err.message || '加载排课数据失败');
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!selectedInstitution) return;
    if (!confirm('确定要同步排课数据吗？这将根据多维表格中的排课记录创建/更新定时任务。')) return;

    setSyncing(true);
    setError(null);
    setSyncResult(null);

    try {
      const result = await syncSchedules(selectedInstitution);
      if (result.success) {
        setSyncResult(result.results);
        // Reload to get updated cron job status
        await loadSchedules();
      } else {
        setError('同步失败');
      }
    } catch (err: any) {
      console.error('Failed to sync schedules:', err);
      setError(err.message || '同步失败');
    } finally {
      setSyncing(false);
    }
  };

  const formatWeekday = (day: string | null) => {
    if (!day) return '固定日期';
    const dayMap: Record<string, string> = {
      '0': '周日',
      '1': '周一',
      '2': '周二',
      '3': '周三',
      '4': '周四',
      '5': '周五',
      '6': '周六',
    };
    return dayMap[day] || day;
  };

  const getSelectedInstitutionName = () => {
    const inst = institutions.find(i => i.id === selectedInstitution);
    return inst?.name || '';
  };

  return (
    <div>
      <div className="page-header flex flex-between">
        <h1 className="page-title">排课管理</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>选择校区:</label>
          <select
            className="input"
            value={selectedInstitution}
            onChange={e => setSelectedInstitution(e.target.value)}
            style={{ width: '200px' }}
          >
            {institutions.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={loadSchedules}>
            刷新
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSync}
            disabled={syncing || !selectedInstitution}
          >
            {syncing ? '同步中...' : '同步排课'}
          </button>
        </div>
      </div>

      {syncResult && (
        <div className="card" style={{ marginBottom: '16px', background: 'rgba(76, 175, 80, 0.1)' }}>
          <div style={{ fontWeight: 500, marginBottom: '8px', color: 'var(--success-color)' }}>
            同步完成
          </div>
          <div style={{ fontSize: '14px' }}>
            新建: {syncResult.created} | 更新: {syncResult.updated} | 跳过: {syncResult.skipped}
            {syncResult.errors.length > 0 && (
              <div style={{ color: 'var(--error-color)', marginTop: '8px' }}>
                错误: {syncResult.errors.join('; ')}
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">
          <div className="loading">加载中...</div>
        </div>
      ) : error ? (
        <div className="card">
          <div className="empty-state">
            <p className="text-secondary" style={{ color: 'var(--error-color)' }}>{error}</p>
          </div>
        </div>
      ) : !selectedInstitution ? (
        <div className="card">
          <div className="empty-state">
            <p className="text-secondary">请选择校区</p>
          </div>
        </div>
      ) : schedules.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="text-secondary">该校区暂无排课数据</p>
            <p className="text-secondary" style={{ fontSize: '12px', marginTop: '8px' }}>
              请确保已在多维表格中配置排课管理表
            </p>
            <button
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
              onClick={handleSync}
              disabled={syncing}
            >
              {syncing ? '同步中...' : '同步排课'}
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-color)', borderRadius: '6px' }}>
            <strong>{getSelectedInstitutionName()}</strong> 的课程表
            <span style={{ color: 'var(--text-secondary)', marginLeft: '8px', fontSize: '12px' }}>
              共 {schedules.length} 条课程记录，已创建 {totalCronJobs} 个定时任务
            </span>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>课程</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>班级名称</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>上课时间</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>周期</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>校区</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>定时任务</th>
              </tr>
            </thead>
            <tbody>
              {schedules.map((schedule, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>
                    {schedule.course_type || '-'}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px' }}>
                    {schedule.course_name || '-'}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px' }}>
                    {schedule.class_time || '-'}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px' }}>
                    {formatWeekday(schedule.weekday)}
                  </td>
                  <td style={{ padding: '12px 8px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {schedule.campus || '-'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {schedule.cron_job_id ? (
                      <span className="badge badge-info">
                        {schedule.cron_enabled ? '已启用' : '已停用'} | {schedule.cron_schedule}
                      </span>
                    ) : (
                      <span className="badge badge-default">未配置</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ScheduleManagementPage;
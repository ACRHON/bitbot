/**
 * Schedule Management Admin Page
 * View and manage course schedules from Bitable
 */

import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from './AuthContext';
import { Institution, syncSchedules, getScheduleStatus, ScheduleStatusItem } from '../lib/api';

const WEEKDAYS = [
  { key: '0', label: '周日' },
  { key: '1', label: '周一' },
  { key: '2', label: '周二' },
  { key: '3', label: '周三' },
  { key: '4', label: '周四' },
  { key: '5', label: '周五' },
  { key: '6', label: '周六' },
];

const ScheduleManagementPage: React.FC = () => {
  const { token } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState<string>('');
  const [schedules, setSchedules] = useState<ScheduleStatusItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [selectedWeekday, setSelectedWeekday] = useState<string>('all');

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

  // Group schedules by weekday
  const groupedSchedules = useMemo(() => {
    if (selectedWeekday === 'all') {
      // Group by weekday: 0-6 first (in order), then fixed-date (null) at end
      const groups: Record<string, ScheduleStatusItem[]> = {
        '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [], 'fixed': []
      };
      schedules.forEach(s => {
        if (s.weekday === null) {
          groups['fixed'].push(s);
        } else {
          groups[s.weekday]?.push(s);
        }
      });
      return groups;
    } else {
      // Filter single day
      const singleDay: ScheduleStatusItem[] = schedules.filter(s => s.weekday === selectedWeekday);
      return { [selectedWeekday]: singleDay };
    }
  }, [schedules, selectedWeekday]);

  const getWeekdayCount = (day: string) => {
    if (day === 'fixed') {
      return schedules.filter(s => s.weekday === null).length;
    }
    return schedules.filter(s => s.weekday === day).length;
  };

  const getWeekdayLabel = (day: string) => {
    if (day === 'fixed') return '固定日期';
    const found = WEEKDAYS.find(w => w.key === day);
    return found?.label || day;
  };

  const hasSchedules = schedules.length > 0;

  return (
    <div>
      <div className="page-header flex flex-between">
        <h1 className="page-title">排课管理</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select
            className="input"
            value={selectedInstitution}
            onChange={e => setSelectedInstitution(e.target.value)}
            style={{ width: '160px' }}
          >
            {institutions.map(inst => (
              <option key={inst.id} value={inst.id}>{inst.name}</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={loadSchedules} disabled={loading}>
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

      {/* Weekday filter tabs */}
      {hasSchedules && (
        <div className="card" style={{ marginBottom: '16px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${selectedWeekday === 'all' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedWeekday('all')}
            >
              全部 ({schedules.length})
            </button>
            {WEEKDAYS.map(w => {
              const count = getWeekdayCount(w.key);
              return (
                <button
                  key={w.key}
                  className={`btn btn-sm ${selectedWeekday === w.key ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedWeekday(w.key)}
                  style={{ minWidth: '60px' }}
                >
                  {w.label} ({count})
                </button>
              );
            })}
            <button
              className={`btn btn-sm ${selectedWeekday === 'fixed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedWeekday('fixed')}
            >
              固定日期 ({getWeekdayCount('fixed')})
            </button>
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
      ) : !hasSchedules ? (
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
        <div>
          {Object.entries(groupedSchedules).map(([day, daySchedules]) => {
            if (daySchedules.length === 0) return null;

            return (
              <div key={day} className="card" style={{ marginBottom: '12px' }}>
                <div style={{
                  padding: '10px 14px',
                  background: 'var(--bg-color)',
                  borderRadius: '6px 6px 0 0',
                  borderBottom: '1px solid var(--border-color)',
                  fontWeight: 600,
                  fontSize: '14px',
                }}>
                  {getWeekdayLabel(day)}
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 400, marginLeft: '8px', fontSize: '12px' }}>
                    {daySchedules.length} 节课
                  </span>
                </div>

                <div style={{ padding: '12px' }}>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {daySchedules.map((schedule) => (
                      <div
                        key={schedule.record_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 12px',
                          background: 'var(--bg-color)',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                        }}
                      >
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 700,
                          color: 'var(--primary-color)',
                          minWidth: '50px',
                          textAlign: 'center',
                        }}>
                          {schedule.class_time || '--:--'}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, marginBottom: '2px' }}>
                            {schedule.course_name || schedule.course_type || '未命名课程'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            {schedule.campus && `📍 ${schedule.campus}`}
                            {schedule.duration_minutes && ` ⏱ ${schedule.duration_minutes}分钟`}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {schedule.cron_job_id ? (
                            <span className={`badge ${schedule.cron_enabled ? 'badge-success' : 'badge-warning'}`}>
                              {schedule.cron_enabled ? '已启用' : '已停用'}
                            </span>
                          ) : (
                            <span className="badge badge-default">未配置</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ScheduleManagementPage;
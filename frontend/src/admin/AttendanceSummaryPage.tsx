/**
 * Attendance Summary Page
 * View all attendance records with filters
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { listAttendanceRecords, AttendanceRecord, Institution } from '../lib/api';

const AttendanceSummaryPage: React.FC = () => {
  const { token } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ signIn: 0, leave: 0, absent: 0, pending: 0 });

  // Filters
  const [institutionId, setInstitutionId] = useState('');
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [institutionId, status, keyword, dateFrom, dateTo]);

  const fetchInstitutions = async () => {
    try {
      const res = await fetch(`/api/admin/institutions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInstitutions(data);
      }
    } catch (err) {
      console.error('Failed to fetch institutions:', err);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const result = await listAttendanceRecords({
        institution_id: institutionId || undefined,
        status: status || undefined,
        keyword: keyword || undefined,
        date_from: dateFrom ? new Date(dateFrom).getTime().toString() : undefined,
        date_to: dateTo ? new Date(dateTo).getTime().toString() : undefined,
      });
      setRecords(result.records || []);

      // Calculate stats
      const all = result.records || [];
      setTotal(all.length);
      setStats({
        signIn: all.filter(r => r.sign_status === '已到').length,
        leave: all.filter(r => r.sign_status === '请假').length,
        absent: all.filter(r => r.sign_status === '缺勤').length,
        pending: all.filter(r => r.sign_status === '待签到').length,
      });
    } catch (err) {
      console.error('Failed to fetch records:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (timestamp: number | null) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case '已到':
        return <span className="badge badge-success">{status}</span>;
      case '请假':
        return <span className="badge badge-warning">{status}</span>;
      case '缺勤':
        return <span className="badge badge-danger">{status}</span>;
      default:
        return <span className="badge badge-secondary">{status}</span>;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchRecords();
  };

  const clearFilters = () => {
    setInstitutionId('');
    setStatus('');
    setKeyword('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">考勤记录</h1>
      </div>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '16px',
      }}>
        <div className="card" style={{ textAlign: 'center', padding: '12px' }}>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{total}</div>
          <div className="text-secondary" style={{ fontSize: '12px' }}>总记录</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '12px', borderLeft: '3px solid var(--success-color)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success-color)' }}>{stats.signIn}</div>
          <div className="text-secondary" style={{ fontSize: '12px' }}>已到</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '12px', borderLeft: '3px solid var(--warning-color)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning-color)' }}>{stats.leave}</div>
          <div className="text-secondary" style={{ fontSize: '12px' }}>请假</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '12px', borderLeft: '3px solid var(--danger-color)' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger-color)' }}>{stats.absent}</div>
          <div className="text-secondary" style={{ fontSize: '12px' }}>缺勤</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '12px', borderLeft: '3px solid #999' }}>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#999' }}>{stats.pending}</div>
          <div className="text-secondary" style={{ fontSize: '12px' }}>待签到</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">机构</label>
              <select
                className="form-input"
                value={institutionId}
                onChange={e => setInstitutionId(e.target.value)}
              >
                <option value="">全部机构</option>
                {institutions.map(inst => (
                  <option key={inst.id} value={inst.id}>{inst.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">状态</label>
              <select
                className="form-input"
                value={status}
                onChange={e => setStatus(e.target.value)}
              >
                <option value="">全部状态</option>
                <option value="已到">已到</option>
                <option value="请假">请假</option>
                <option value="缺勤">缺勤</option>
                <option value="待签到">待签到</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">关键词</label>
              <input
                type="text"
                className="form-input"
                placeholder="学员姓名"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary">搜索</button>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>清空</button>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', marginTop: '12px', alignItems: 'end' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">开始日期</label>
              <input
                type="date"
                className="form-input"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">结束日期</label>
              <input
                type="date"
                className="form-input"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
              />
            </div>
            <div></div>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无考勤记录</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>机构</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>学员</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>课程</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>班级</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>上课时间</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>签到方式</th>
              </tr>
            </thead>
            <tbody>
              {records.map(record => (
                <tr key={record.record_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{record.institution_name}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{record.student_name}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{record.course_name}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{record.class_name}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{formatDateTime(record.scheduled_time)}</td>
                  <td style={{ padding: '12px 8px' }}>{getStatusBadge(record.sign_status)}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{record.sign_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AttendanceSummaryPage;
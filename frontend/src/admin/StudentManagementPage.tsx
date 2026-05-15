/**
 * Student Management Page
 * View all students with search
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { listStudentsAdmin, StudentRecord, Institution } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const StudentManagementPage: React.FC = () => {
  const { token } = useAuth();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [institutionId, setInstitutionId] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    fetchInstitutions();
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [institutionId, keyword]);

  const fetchInstitutions = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/institutions`, {
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

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const result = await listStudentsAdmin({
        institution_id: institutionId || undefined,
        keyword: keyword || undefined,
      });
      setStudents(result.students || []);
      setTotal(result.students?.length || 0);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return '-';
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents();
  };

  const clearFilters = () => {
    setInstitutionId('');
    setKeyword('');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">学员管理</h1>
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
          <div className="text-secondary" style={{ fontSize: '12px' }}>总学员数</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <form onSubmit={handleSearch}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '12px', alignItems: 'end' }}>
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
              <label className="form-label">关键词</label>
              <input
                type="text"
                className="form-input"
                placeholder="输入姓名或电话搜索"
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" className="btn btn-primary">搜索</button>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>清空</button>
            </div>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : students.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无学员</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>机构</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>姓名</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>电话</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>家长电话</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>班级</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {students.map(student => (
                <tr key={student.record_id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{student.institution_name}</td>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{student.name}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{student.phone || '-'}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{student.parent_phone || '-'}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px' }}>{student.class_name || '-'}</td>
                  <td style={{ padding: '12px 8px', fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDate(student.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StudentManagementPage;
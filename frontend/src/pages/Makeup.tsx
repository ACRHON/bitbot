/**
 * Makeup Page
 * View absent records and manually sign (makeup) for students
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getSession, getSessionAbsences, makeupSign, AttendanceSession } from '../lib/api';
import { isDevMode } from '../lib/mock';

interface AbsenceRecord {
  record_id: string;
  name: string;
  course_name: string;
  class_name: string;
  scheduled_time: number | null;
}

const Makeup: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [absences, setAbsences] = useState<AbsenceRecord[]>([]);
  const [makingUp, setMakingUp] = useState<string | null>(null);

  const sessionId = searchParams.get('sess');

  useEffect(() => {
    const load = async () => {
      // In dev mode, use mock session if no sessionId provided
      const effectiveSessionId = isDevMode && !sessionId ? 'dev_session' : sessionId;

      if (!effectiveSessionId) {
        setError('缺少 session 参数');
        setLoading(false);
        return;
      }

      try {
        const sessionData = await getSession(effectiveSessionId);
        setSession(sessionData);

        const result = await getSessionAbsences(effectiveSessionId);
        if (result.error) {
          setError(result.error);
        } else {
          setAbsences(result.absences || []);
        }
      } catch (err) {
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  const handleMakeup = async (record: AbsenceRecord) => {
    if (!sessionId) return;
    if (!confirm(`确定要为 ${record.name} 补签吗？`)) return;

    setMakingUp(record.record_id);
    try {
      await makeupSign(sessionId, record.record_id, record.name);
      // Remove from list after successful makeup
      setAbsences(prev => prev.filter(a => a.record_id !== record.record_id));
      alert('补签成功');
    } catch (err) {
      alert('补签失败');
    } finally {
      setMakingUp(null);
    }
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return (
      <div className="container">
        <div className="card">
          <div className="empty-state">
            <p className="text-danger">{error}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-header">
        <div className="flex flex-between flex-center">
          <h1 className="page-title">补签管理</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            ← 返回
          </button>
        </div>
      </div>

      {/* Session Info */}
      {session && (
        <div className="card mb-16">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div className="text-secondary" style={{ fontSize: '12px' }}>课程</div>
              <div style={{ fontWeight: 600 }}>{session.course_name || '-'}</div>
            </div>
            <div>
              <div className="text-secondary" style={{ fontSize: '12px' }}>班级</div>
              <div style={{ fontWeight: 600 }}>{session.class_name || '-'}</div>
            </div>
            <div>
              <div className="text-secondary" style={{ fontSize: '12px' }}>老师</div>
              <div>{session.teacher_name || '-'}</div>
            </div>
            <div>
              <div className="text-secondary" style={{ fontSize: '12px' }}>上课时间</div>
              <div>{formatTime(session.scheduled_time)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Absences List */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          缺勤记录 ({absences.length}人)
        </h3>

        {absences.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无缺勤记录</p>
          </div>
        ) : (
          <div>
            {absences.map(record => (
              <div key={record.record_id} className="list-item">
                <div>
                  <div style={{ fontWeight: 500 }}>{record.name}</div>
                  <div className="text-danger" style={{ fontSize: '12px' }}>
                    缺勤
                  </div>
                </div>
                <button
                  className="btn btn-success"
                  disabled={makingUp === record.record_id}
                  onClick={() => handleMakeup(record)}
                >
                  {makingUp === record.record_id ? '补签中...' : '✅ 补签'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Makeup;

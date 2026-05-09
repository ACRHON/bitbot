/**
 * Attendance Page
 * Core attendance taking interface with advanced features
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getSession, signStudent, getSessionStudents, AttendanceSession, Student, searchStudents, addTempStudent, undoSign, getAttendanceLogs, AttendanceLog, endSession } from '../lib/api';
import { isDevMode } from '../lib/mock';

const Attendance: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [signing, setSigning] = useState<string | null>(null);

  // UI states
  const [showSearch, setShowSearch] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);

  const sessionId = searchParams.get('sess');

  const handleEndSession = async () => {
    if (!sessionId) return;

    const confirmed = confirm('确定要下课吗？下课后将锁定考勤记录，但仍可修改（会保留操作日志）。');
    if (!confirmed) return;

    try {
      await endSession(sessionId);
      setSessionEnded(true);
      alert('已下课，考勤已锁定');
    } catch (err) {
      alert('操作失败');
    }
  };

  // Load session and students
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

        // Fetch students from bitable
        const result = await getSessionStudents(effectiveSessionId);
        if (result.error && result.error !== 'Bitable not configured') {
          setError(result.error);
        } else if (result.students && result.students.length > 0) {
          setStudents(result.students.map(s => ({ ...s, status: undefined })));
        } else {
          // Fallback to demo data if no students configured
          setStudents([
            { record_id: '1', name: '张三', status: undefined },
            { record_id: '2', name: '李四', status: undefined },
            { record_id: '3', name: '王五', status: undefined },
            { record_id: '4', name: '赵六', status: undefined },
            { record_id: '5', name: '钱七', status: undefined },
          ]);
        }
      } catch (err) {
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [sessionId]);

  const handleSign = useCallback(async (
    studentRecordId: string,
    studentName: string,
    status: 'sign_in' | 'leave' | 'absent'
  ) => {
    if (!sessionId) return;

    setSigning(studentRecordId);
    try {
      await signStudent(sessionId, studentRecordId, studentName, status);

      // Update local state
      setStudents(prev =>
        prev.map(s =>
          s.record_id === studentRecordId
            ? { ...s, status }
            : s
        )
      );
    } catch (err) {
      alert('签到失败，请重试');
    } finally {
      setSigning(null);
      setShowStatusMenu(null);
    }
  }, [sessionId]);

  const handleUndo = useCallback(async (
    studentRecordId: string,
    studentName: string,
    fromStatus: string
  ) => {
    if (!sessionId) return;

    let reason = '误操作';
    if (sessionEnded) {
      reason = prompt('下课后修改，请输入原因（将记录到日志）：') || '下课后修改';
      if (!reason) return;
    } else {
      if (!confirm(`确定要撤销 ${studentName} 的签到状态吗？`)) return;
    }

    setSigning(studentRecordId);
    try {
      await undoSign(sessionId, studentRecordId, studentName, fromStatus, reason);

      // Update local state
      setStudents(prev =>
        prev.map(s =>
          s.record_id === studentRecordId
            ? { ...s, status: undefined }
            : s
        )
      );
    } catch (err) {
      alert('撤销失败，请重试');
    } finally {
      setSigning(null);
      setShowStatusMenu(null);
    }
  }, [sessionId, sessionEnded]);

  const handleSearch = async () => {
    if (!sessionId || !searchKeyword.trim()) return;

    setSearching(true);
    try {
      const result = await searchStudents(sessionId, searchKeyword);
      if (result.error) {
        alert(result.error);
      } else {
        setSearchResults(result.students || []);
      }
    } catch (err) {
      alert('搜索失败');
    } finally {
      setSearching(false);
    }
  };

  const handleAddStudent = async (student: Student, action: 'temp_makeup' | 'transfer_class') => {
    if (!sessionId) return;

    const confirmed = confirm(
      action === 'transfer_class'
        ? `确定将 ${student.name} 调入本班？\n（同时更新该学员的所属班级）`
        : `确定将 ${student.name} 作为临时补课学员添加？`
    );

    if (!confirmed) return;

    try {
      await addTempStudent(sessionId, student.record_id, student.name, action, student.class_name);
      setShowSearch(false);
      setSearchKeyword('');
      setSearchResults([]);
      alert('添加成功');
      // Refresh students list
      const result = await getSessionStudents(sessionId);
      if (result.students) {
        setStudents(result.students.map(s => ({ ...s, status: undefined })));
      }
    } catch (err) {
      alert('添加失败');
    }
  };

  const handleOneClickSignAll = () => {
    const unsigned = students.filter(s => !s.status);
    if (unsigned.length === 0) {
      alert('没有待签到的学员');
      return;
    }

    const confirmed = confirm(`确定将 ${unsigned.length} 名待签到学员全部标记为"已到"？`);
    if (!confirmed) return;

    unsigned.forEach(student => {
      handleSign(student.record_id, student.name, 'sign_in');
    });
  };

  const handleViewLogs = async () => {
    if (!sessionId) return;

    try {
      const result = await getAttendanceLogs(sessionId);
      setLogs(result.logs || []);
      setShowLogs(true);
    } catch (err) {
      alert('获取日志失败');
    }
  };

  const formatTime = (timestamp: number | null) => {
    if (!timestamp) return '--:--';
    const d = new Date(timestamp);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const formatDateTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'sign_in': return { label: '✅ 已到', class: 'badge-success' };
      case 'leave': return { label: '📝 请假', class: 'badge-warning' };
      case 'absent': return { label: '❌ 缺勤', class: 'badge-danger' };
      default: return { label: '⏳ 待签到', class: 'badge-secondary' };
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'sign_in': return '签到';
      case 'leave': return '请假';
      case 'absent': return '缺勤';
      case 'undo_sign': return '撤销';
      case 'add_temp': return '添加临时学员';
      default: return action;
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error || !session) {
    return (
      <div className="container">
        <div className="card">
          <div className="empty-state">
            <p className="text-danger">{error || '会话不存在'}</p>
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              返回首页
            </button>
          </div>
        </div>
      </div>
    );
  }

  const unsignedCount = students.filter(s => !s.status).length;
  const signedCount = students.filter(s => s.status === 'sign_in').length;
  const leaveCount = students.filter(s => s.status === 'leave').length;
  const absentCount = students.filter(s => s.status === 'absent').length;

  return (
    <div className="container">
      <div className="page-header">
        <div className="flex flex-between flex-center">
          <div className="flex flex-col gap-4">
            <h1 className="page-title">课节点名</h1>
            {sessionEnded && (
              <span className="badge badge-warning">已下课 - 可修改（会保留日志）</span>
            )}
          </div>
          <div className="flex gap-8">
            {!sessionEnded && (
              <button className="btn btn-warning" onClick={handleEndSession}>
                🔒 下课锁定
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
              ← 返回
            </button>
          </div>
        </div>
      </div>

      {/* Session Info */}
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

      {/* Stats */}
      <div className="card mb-16">
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success-color)' }}>{signedCount}</div>
            <div className="text-secondary">已到</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--warning-color)' }}>{leaveCount}</div>
            <div className="text-secondary">请假</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger-color)' }}>{absentCount}</div>
            <div className="text-secondary">缺勤</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700 }}>{unsignedCount}</div>
            <div className="text-secondary">待签到</div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="card mb-16">
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowSearch(true)}>
            + 添加学员
          </button>
          <button
            className="btn btn-success"
            onClick={handleOneClickSignAll}
            disabled={unsignedCount === 0}
          >
            ✅ 一键签到 ({unsignedCount})
          </button>
          <button className="btn btn-secondary" onClick={handleViewLogs}>
            📋 操作日志
          </button>
        </div>
      </div>

      {/* Student List */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          学员列表 ({students.length}人)
        </h3>

        {students.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无学员</p>
          </div>
        ) : (
          <div>
            {students.map(student => {
              const statusInfo = getStatusLabel(student.status);
              const isSigned = !!student.status;

              return (
                <div key={student.record_id} className="list-item" style={{ position: 'relative' }}>
                  <div>
                    <div style={{ fontWeight: 500 }}>{student.name}</div>
                    <div className={statusInfo.class} style={{ fontSize: '12px' }}>
                      {statusInfo.label}
                    </div>
                  </div>

                  {isSigned ? (
                    <div style={{ position: 'relative' }}>
                      <button
                        className={`badge ${statusInfo.class}`}
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => setShowStatusMenu(showStatusMenu === student.record_id ? null : student.record_id)}
                      >
                        {statusInfo.label} ▼
                      </button>
                      {showStatusMenu === student.record_id && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          background: 'var(--card-bg)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '8px',
                          zIndex: 100,
                          minWidth: '120px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                        }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ width: '100%', marginBottom: '4px' }}
                            onClick={() => handleSign(student.record_id, student.name, 'leave')}
                          >
                            改为请假
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ width: '100%', marginBottom: '4px' }}
                            onClick={() => handleSign(student.record_id, student.name, 'absent')}
                          >
                            改为缺勤
                          </button>
                          <button
                            className="btn btn-warning btn-sm"
                            style={{ width: '100%' }}
                            onClick={() => handleUndo(student.record_id, student.name, student.status!)}
                          >
                            撤销
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-8">
                      <button
                        className="btn btn-success"
                        disabled={signing === student.record_id}
                        onClick={() => handleSign(student.record_id, student.name, 'sign_in')}
                      >
                        {signing === student.record_id ? '...' : '✅ 签到'}
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={signing === student.record_id}
                        onClick={() => handleSign(student.record_id, student.name, 'leave')}
                      >
                        📝 请假
                      </button>
                      <button
                        className="btn btn-danger"
                        disabled={signing === student.record_id}
                        onClick={() => handleSign(student.record_id, student.name, 'absent')}
                      >
                        ❌ 缺勤
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Search Student Modal */}
      {showSearch && (
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
          <div className="card" style={{ width: '100%', maxWidth: '500px', maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              添加学员
            </h2>

            <div className="form-group">
              <input
                type="text"
                className="input"
                placeholder="输入学员姓名搜索"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button className="btn btn-primary" onClick={handleSearch} disabled={searching}>
                {searching ? '搜索中...' : '搜索'}
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowSearch(false); setSearchKeyword(''); setSearchResults([]); }}>
                关闭
              </button>
            </div>

            {searchResults.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>搜索结果：</h4>
                {searchResults.map(student => (
                  <div key={student.record_id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ fontWeight: 500 }}>{student.name}</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleAddStudent(student, 'temp_makeup')}
                      >
                        临时补课
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleAddStudent(student, 'transfer_class')}
                      >
                        调班到本班
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchKeyword && searchResults.length === 0 && !searching && (
              <p className="text-secondary">未找到匹配的学员</p>
            )}
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {showLogs && (
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
          <div className="card" style={{ width: '100%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              操作日志
            </h2>

            {logs.length === 0 ? (
              <p className="text-secondary">暂无操作记录</p>
            ) : (
              <div>
                {logs.map(log => (
                  <div key={log.id} className="list-item" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                      <span style={{ fontWeight: 500 }}>{log.student_name || '未知学员'}</span>
                      <span className="text-secondary" style={{ fontSize: '12px' }}>
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      操作：{getActionLabel(log.action)}
                      {log.from_status && log.action === 'undo_sign' && `（从${log.from_status}撤销）`}
                      {log.reason && `，原因：${log.reason}`}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowLogs(false)}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Attendance;

/**
 * Campus Management Page
 * Manage students, courses, and classes for an institution
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { checkAuth, Institution, User, getCampusData, createStudent, updateStudent } from '../lib/api';

type TabType = 'students' | 'courses' | 'classes';

interface Student {
  record_id: string;
  name: string;
  phone?: string;
  parent_phone?: string;
  [key: string]: any;
}

interface Course {
  record_id: string;
  name: string;
  description?: string;
  [key: string]: any;
}

interface Class {
  record_id: string;
  name: string;
  course_id?: string;
  teacher_name?: string;
  [key: string]: any;
}

const CampusManagement: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('students');
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const openId = urlParams.get('open_id') || 'demo_user';

        const result = await checkAuth(openId);

        if (!result.authorized) {
          setError(result.message || '未授权');
        } else {
          const institution = result.institution;
          setInstitution(institution || null);
          setUser(result.user || null);

          if (institution?.id) {
            // Fetch from Bitable via API
            const data = await getCampusData(institution.id);
            setStudents(data.students || []);
            setCourses(data.courses || []);
            setClasses(data.classes || []);
          } else {
            // No institution configured, use empty data
            setStudents([]);
            setCourses([]);
            setClasses([]);
          }
        }
      } catch (err) {
        console.error('Failed to load campus data:', err);
        setError('加载失败');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormData({});
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setFormData({ ...item });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!institution?.id) return;

    setSaving(true);
    try {
      const fields: Record<string, any> = {};
      getFormFields().forEach(field => {
        if (formData[field.key]) {
          fields[field.label] = formData[field.key];
        }
      });

      if (editing) {
        if (activeTab === 'students') {
          await updateStudent(institution.id, editing.record_id, fields);
        }
        // Reload data
        const data = await getCampusData(institution.id);
        setStudents(data.students || []);
        setCourses(data.courses || []);
        setClasses(data.classes || []);
      } else {
        if (activeTab === 'students') {
          await createStudent(institution.id, fields);
        }
        // Reload data
        const data = await getCampusData(institution.id);
        setStudents(data.students || []);
        setCourses(data.courses || []);
        setClasses(data.classes || []);
      }
      setShowModal(false);
      alert('保存成功');
    } catch (err) {
      console.error('Save failed:', err);
      alert('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (_tab: TabType, _recordId: string) => {
    if (!confirm('确定要删除吗？')) return;
    // Note: In production, this would call an API to delete from bitable
    alert('删除成功（演示模式）');
  };

  const getFormFields = () => {
    switch (activeTab) {
      case 'students':
        return [
          { key: 'name', label: '姓名', required: true },
          { key: 'phone', label: '电话' },
          { key: 'parent_phone', label: '家长电话' },
        ];
      case 'courses':
        return [
          { key: 'name', label: '课程名称', required: true },
          { key: 'description', label: '描述' },
        ];
      case 'classes':
        return [
          { key: 'name', label: '班级名称', required: true },
          { key: 'course_id', label: '所属课程' },
          { key: 'teacher_name', label: '老师' },
        ];
      default:
        return [];
    }
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

  const renderList = () => {
    let data: any[] = [];
    switch (activeTab) {
      case 'students':
        data = students;
        break;
      case 'courses':
        data = courses;
        break;
      case 'classes':
        data = classes;
        break;
    }

    if (data.length === 0) {
      return (
        <div className="empty-state">
          <p className="text-secondary">暂无数据</p>
        </div>
      );
    }

    return (
      <div>
        {data.map(item => (
          <div key={item.record_id} className="list-item">
            <div>
              <div style={{ fontWeight: 500 }}>{item.name}</div>
              <div className="text-secondary" style={{ fontSize: '12px' }}>
                {activeTab === 'students' && item.phone && `电话: ${item.phone}`}
                {activeTab === 'students' && item.parent_phone && ` 家长电话: ${item.parent_phone}`}
                {activeTab === 'courses' && item.description}
                {activeTab === 'classes' && item.teacher_name && `老师: ${item.teacher_name}`}
              </div>
            </div>
            <div className="flex gap-8">
              <button className="btn btn-secondary btn-sm" onClick={() => openEdit(item)}>
                编辑
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => handleDelete(activeTab, item.record_id)}>
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container">
      <div className="page-header">
        <div className="flex flex-between flex-center">
          <h1 className="page-title">校区管理</h1>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            ← 返回
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="card mb-16">
        <div className="flex gap-8" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '16px' }}>
          <button
            className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('students')}
          >
            学员
          </button>
          <button
            className={`btn ${activeTab === 'courses' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('courses')}
          >
            课程
          </button>
          <button
            className={`btn ${activeTab === 'classes' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('classes')}
          >
            班级
          </button>
        </div>

        <div className="flex flex-between mb-16">
          <h3 style={{ fontSize: '14px', fontWeight: 600 }}>
            {activeTab === 'students' && `学员列表 (${students.length})`}
            {activeTab === 'courses' && `课程列表 (${courses.length})`}
            {activeTab === 'classes' && `班级列表 (${classes.length})`}
          </h3>
          <button className="btn btn-primary btn-sm" onClick={openCreate}>
            + 添加
          </button>
        </div>

        {renderList()}
      </div>

      {/* Modal */}
      {showModal && (
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
              {editing ? '编辑' : '添加'}
              {activeTab === 'students' && '学员'}
              {activeTab === 'courses' && '课程'}
              {activeTab === 'classes' && '班级'}
            </h2>
            <div className="form-group">
              {getFormFields().map(field => (
                <div key={field.key} style={{ marginBottom: '12px' }}>
                  <label className="form-label">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type="text"
                    className="input"
                    value={formData[field.key] || ''}
                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampusManagement;

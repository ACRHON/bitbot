/**
 * Institutions Management Page
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { validateActivationCode } from '../lib/api';

interface Institution {
  id: string;
  name: string;
  feishu_app_id: string;
  feishu_verification_token?: string | null;
  feishu_encrypt_key?: string | null;
  status: string;
  expires_at: number;
  created_at: number;
  activation_code?: string | null;
  bitable_base_id?: string | null;
  bitable_student_table_id?: string | null;
  bitable_sign_record_table_id?: string | null;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';

const InstitutionsPage: React.FC = () => {
  const { token } = useAuth();
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Institution | null>(null);

  // Form state - simplified
  const [formData, setFormData] = useState({
    name: '',
    feishu_app_id: '',
    feishu_app_secret: '',
    feishu_verification_token: '',
    feishu_encrypt_key: '',
    bitable_base_id: '',
    activation_code: '',
  });

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 3;
  const [validating, setValidating] = useState(false);
  const [activationCodeInfo, setActivationCodeInfo] = useState<{ duration_days: number; expires_at: number } | null>(null);

  // Validation for each step
  const canProceedFromStep1 = async () => {
    if (!formData.name.trim()) {
      alert('请输入机构名称');
      return false;
    }
    if (!editing && !formData.activation_code.trim()) {
      alert('请输入激活码');
      return false;
    }
    // Validate activation code via API (only for new institutions)
    if (!editing && formData.activation_code.trim()) {
      setValidating(true);
      try {
        const result = await validateActivationCode(formData.activation_code.trim());
        if (!result.valid) {
          alert(result.error || '激活码无效');
          setValidating(false);
          return false;
        }
        setActivationCodeInfo({ duration_days: result.duration_days!, expires_at: result.expires_at! });
      } catch (err) {
        alert('激活码验证失败，请重试');
        setValidating(false);
        return false;
      }
      setValidating(false);
    }
    return true;
  };

  const canProceedFromStep2 = () => {
    if (!formData.feishu_app_id.trim()) {
      alert('请输入飞书 App ID');
      return false;
    }
    if (!editing && !formData.feishu_app_secret.trim()) {
      alert('请输入飞书 App Secret');
      return false;
    }
    return true;
  };

  const handleNextStep = async () => {
    if (currentStep === 1) {
      const canProceed = await canProceedFromStep1();
      if (!canProceed) return;
    }
    if (currentStep === 2 && !canProceedFromStep2()) return;
    setCurrentStep(s => s + 1);
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editing
        ? `${API_BASE}/api/admin/institutions/${editing.id}`
        : `${API_BASE}/api/admin/institutions`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setShowModal(false);
        setEditing(null);
        resetForm();
        fetchInstitutions();
      } else {
        const data = await res.json();
        alert(data.error || '保存失败');
      }
    } catch (err) {
      console.error('Failed to save institution:', err);
      alert('保存失败');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该机构吗？此操作不可恢复。')) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/institutions/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchInstitutions();
      }
    } catch (err) {
      console.error('Failed to delete institution:', err);
    }
  };

  const handleEdit = (inst: Institution) => {
    setEditing(inst);
    setFormData({
      name: inst.name,
      feishu_app_id: inst.feishu_app_id || '',
      feishu_app_secret: '',
      feishu_verification_token: inst.feishu_verification_token || '',
      feishu_encrypt_key: inst.feishu_encrypt_key || '',
      bitable_base_id: inst.bitable_base_id || '',
      activation_code: '',
    });
    setCurrentStep(1);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      feishu_app_id: '',
      feishu_app_secret: '',
      feishu_verification_token: '',
      feishu_encrypt_key: '',
      bitable_base_id: '',
      activation_code: '',
    });
    setCurrentStep(1);
    setActivationCodeInfo(null);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  const isExpiringSoon = (expiresAt: number) => {
    return expiresAt - Date.now() < 30 * 24 * 60 * 60 * 1000;
  };

  return (
    <div>
      <div className="page-header flex flex-between">
        <h1 className="page-title">机构管理</h1>
        <button
          className="btn btn-primary"
          onClick={() => {
            resetForm();
            setEditing(null);
            setShowModal(true);
          }}
        >
          + 添加机构
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : institutions.length === 0 ? (
          <div className="empty-state">
            <p className="text-secondary">暂无机构</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>机构名称</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>App ID</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>状态</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>到期时间</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {institutions.map(inst => (
                <tr key={inst.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 500 }}>{inst.name}</td>
                  <td style={{ padding: '12px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>{inst.feishu_app_id}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${inst.status === 'active' ? 'badge-success' : inst.status === 'expired' ? 'badge-danger' : 'badge-warning'}`}>
                      {inst.status === 'active' ? '运行中' : inst.status === 'expired' ? '已到期' : '已停用'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', color: isExpiringSoon(inst.expires_at) ? 'var(--warning-color)' : 'inherit' }}>
                    {formatDate(inst.expires_at)}
                    {isExpiringSoon(inst.expires_at) && ' ⚠️'}
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <button className="btn btn-secondary" style={{ padding: '4px 8px', marginRight: '4px' }} onClick={() => handleEdit(inst)}>
                      编辑
                    </button>
                    <button className="btn btn-danger" style={{ padding: '4px 8px' }} onClick={() => handleDelete(inst.id)}>
                      删除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          style={{
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
          }}
          onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
                {editing ? '编辑机构' : '添加机构'}
              </h2>
              <button
                type="button"
                onClick={() => { setShowModal(false); setEditing(null); resetForm(); }}
                style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)' }}
              >
                ×
              </button>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
              {[1, 2, 3].map(step => (
                <React.Fragment key={step}>
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: currentStep >= step ? 'var(--primary-color)' : 'var(--border-color)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: 600,
                  }}>
                    {currentStep > step ? '✓' : step}
                  </div>
                  {step < 3 && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      background: currentStep > step ? 'var(--primary-color)' : 'var(--border-color)',
                      margin: '0 8px',
                    }} />
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Step labels */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              <span style={{ color: currentStep === 1 ? 'var(--primary-color)' : 'inherit', fontWeight: currentStep === 1 ? 600 : 400 }}>基本信息</span>
              <span style={{ color: currentStep === 2 ? 'var(--primary-color)' : 'inherit', fontWeight: currentStep === 2 ? 600 : 400 }}>飞书机器人</span>
              <span style={{ color: currentStep === 3 ? 'var(--primary-color)' : 'inherit', fontWeight: currentStep === 3 ? 600 : 400 }}>多维表格</span>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Step 1: Basic Info + Activation */}
              {currentStep === 1 && (
                <div>
                  <div className="form-group">
                    <label className="form-label">机构名称 *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例如：海淀校区"
                      required
                    />
                  </div>

                  <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-color)', borderRadius: '8px' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>激活码</h3>
                    {editing ? (
                      <div className="form-group">
                        <label className="form-label">输入激活码续期（可选）</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.activation_code}
                          onChange={e => setFormData({ ...formData, activation_code: e.target.value })}
                          placeholder="输入激活码自动续期"
                        />
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          当前到期时间: {editing ? formatDate(editing.expires_at) : '-'}
                        </div>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">激活码 *</label>
                        <input
                          type="text"
                          className="form-input"
                          value={formData.activation_code}
                          onChange={e => {
                            setFormData({ ...formData, activation_code: e.target.value });
                            setActivationCodeInfo(null);
                          }}
                          placeholder="输入激活码"
                          required
                        />
                        {activationCodeInfo && (
                          <div style={{ fontSize: '12px', color: 'var(--success-color)', marginTop: '4px' }}>
                            ✓ 激活码有效，可开通 {activationCodeInfo.duration_days} 天（至 {formatDate(activationCodeInfo.expires_at)}）
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Robot Config */}
              {currentStep === 2 && (
                <div>
                  <div className="form-group">
                    <label className="form-label">飞书 App ID *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.feishu_app_id}
                      onChange={e => setFormData({ ...formData, feishu_app_id: e.target.value })}
                      placeholder="cli_xxx"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">飞书 App Secret *</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.feishu_app_secret}
                      onChange={e => setFormData({ ...formData, feishu_app_secret: e.target.value })}
                      placeholder={editing ? '不修改请留空' : '请输入 App Secret'}
                      required={!editing}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Verification Token</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.feishu_verification_token}
                      onChange={e => setFormData({ ...formData, feishu_verification_token: e.target.value })}
                      placeholder="飞书机器人平台的 Verification Token"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Encrypt Key</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.feishu_encrypt_key}
                      onChange={e => setFormData({ ...formData, feishu_encrypt_key: e.target.value })}
                      placeholder="飞书机器人平台的 Encrypt Key"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Bitable Config */}
              {currentStep === 3 && (
                <div>
                  <div style={{ padding: '12px', background: 'rgba(255, 149, 0, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--warning-color)' }}>
                    此步骤可跳过，稍后可在编辑中补充
                  </div>
                  <div className="form-group">
                    <label className="form-label">多维表格 Base ID</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.bitable_base_id}
                      onChange={e => setFormData({ ...formData, bitable_base_id: e.target.value })}
                      placeholder="例如：Bxxx"
                    />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '24px' }}>
                {currentStep > 1 && (
                  <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(s => s - 1)}>
                    上一步
                  </button>
                )}
                {currentStep < TOTAL_STEPS ? (
                  <button type="button" className="btn btn-primary" onClick={(e) => { e.preventDefault(); handleNextStep(); }} disabled={validating}>
                    {validating ? '验证中...' : '下一步'}
                  </button>
                ) : (
                  <button type="submit" className="btn btn-primary">
                    保存
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionsPage;

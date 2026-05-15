/**
 * Institutions Management Page
 */

import React, { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { validateActivationCode, testBitableConnection } from '../lib/api';

interface Institution {
  id: string;
  name: string;
  feishu_app_id: string;
  feishu_app_secret?: string | null;
  feishu_verification_token?: string | null;
  feishu_encrypt_key?: string | null;
  status: string;
  expires_at: number;
  created_at: number;
  activation_code?: string | null;
  bitable_base_id?: string | null;
  bitable_student_table_id?: string | null;
  bitable_sign_record_table_id?: string | null;
  bitable_schedule_table_id?: string | null;
  bitable_tables?: string | null;
}

const API_BASE = import.meta.env.VITE_API_BASE || '';
const WEBHOOK_BASE = 'https://fastbot.de5.net/webhook/feishu';

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
    bitable_student_table_id: '',
    bitable_sign_record_table_id: '',
    bitable_schedule_table_id: '',
    bitable_tables: '',
  });

  // Stepper state
  const [currentStep, setCurrentStep] = useState(1);
  const TOTAL_STEPS = 3;
  const [validating, setValidating] = useState(false);
  const [activationCodeInfo, setActivationCodeInfo] = useState<{ duration_days: number; expires_at: number } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(365); // days
  const [generatingCode, setGeneratingCode] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false); // Permanent authorization

  // Bitable connection test state
  const [bitableTestStatus, setBitableTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [bitableTestMessage, setBitableTestMessage] = useState('');
  const [bitableTestPassed, setBitableTestPassed] = useState(false);

  // Validation for each step
  const canProceedFromStep1 = async () => {
    if (!formData.name.trim()) {
      alert('请输入机构名称');
      return false;
    }
    if (!editing && !formData.activation_code.trim() && !isUnlimited) {
      alert('请输入激活码或选择永久授权');
      return false;
    }
    // Validate activation code via API (only for new institutions with code)
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

    // If bitable URL is provided but test hasn't passed, block submission
    if (formData.bitable_base_id.trim() && !bitableTestPassed) {
      alert('请先点击"测试连接"按钮，确保多维表格连接正常后再保存');
      return;
    }

    try {
      const url = editing
        ? `${API_BASE}/api/admin/institutions/${editing.id}`
        : `${API_BASE}/api/admin/institutions`;
      const method = editing ? 'PUT' : 'POST';

      // Prepare submit data
      const submitData: any = { ...formData };
      if (!editing && isUnlimited) {
        submitData.expires_at = new Date('2099-12-31').getTime();
        submitData.activation_code = ''; // No activation code for unlimited
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(submitData),
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

  const handleToggleStatus = async (inst: Institution) => {
    const newStatus = inst.status === 'active' ? 'suspended' : 'active';
    const actionText = newStatus === 'suspended' ? '冻结' : '启动';

    if (!confirm(`确定要${actionText}该校区「${inst.name}」吗？`)) return;

    try {
      const res = await fetch(`${API_BASE}/api/admin/institutions/${inst.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchInstitutions();
      } else {
        const data = await res.json();
        alert(data.error || `${actionText}失败`);
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
      alert(`${actionText}失败`);
    }
  };

  const handleGenerateActivationCode = async () => {
    setGeneratingCode(true);
    setIsUnlimited(false); // Clear unlimited when generating code
    try {
      const res = await fetch(`${API_BASE}/api/admin/activation/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ count: 1, duration_days: selectedDuration }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.codes && data.codes.length > 0) {
          setFormData({ ...formData, activation_code: data.codes[0].code });
          setActivationCodeInfo({
            duration_days: data.codes[0].duration_days,
            expires_at: data.codes[0].expires_at,
          });
        }
      } else {
        const data = await res.json();
        alert(`生成激活码失败: ${data.error || res.status}`);
      }
    } catch (err) {
      console.error('Failed to generate activation code:', err);
      alert(`生成激活码失败: ${(err as Error).message || '网络错误'}`);
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleSetUnlimited = () => {
    if (isUnlimited) {
      // Disable unlimited mode
      setIsUnlimited(false);
      setActivationCodeInfo(null);
    } else {
      // Enable unlimited mode
      setIsUnlimited(true);
      setFormData({ ...formData, activation_code: '' });
      setActivationCodeInfo({
        duration_days: 99999,
        expires_at: new Date('2099-12-31').getTime(),
      });
    }
  };

  const copyWebhookUrl = (appId: string) => {
    const url = `${WEBHOOK_BASE}/${appId}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Webhook 地址已复制到剪贴板');
    }).catch(() => {
      prompt('请复制以下 Webhook 地址：', url);
    });
  };

  const handleEdit = (inst: Institution) => {
    setEditing(inst);
    setFormData({
      name: inst.name,
      feishu_app_id: inst.feishu_app_id || '',
      feishu_app_secret: inst.feishu_app_secret || '',
      feishu_verification_token: inst.feishu_verification_token || '',
      feishu_encrypt_key: inst.feishu_encrypt_key || '',
      bitable_base_id: inst.bitable_base_id || '',
      activation_code: '',
      bitable_student_table_id: inst.bitable_student_table_id || '',
      bitable_sign_record_table_id: inst.bitable_sign_record_table_id || '',
      bitable_schedule_table_id: inst.bitable_schedule_table_id || '',
      bitable_tables: inst.bitable_tables || '',
    });
    setShowSecret(false); // Hide secret by default when editing
    setIsUnlimited(false);
    setActivationCodeInfo(null);
    setBitableTestStatus('idle');
    setBitableTestPassed(inst.bitable_base_id ? true : false); // Already saved, so consider it tested if has value
    setBitableTestMessage('');
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
      bitable_student_table_id: '',
      bitable_sign_record_table_id: '',
      bitable_schedule_table_id: '',
      bitable_tables: '',
    });
    setCurrentStep(1);
    setActivationCodeInfo(null);
    setIsUnlimited(false);
    setBitableTestStatus('idle');
    setBitableTestPassed(false);
    setBitableTestMessage('');
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
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>Webhook</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>多维表格</th>
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
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => copyWebhookUrl(inst.feishu_app_id)}
                      title="复制 Webhook 地址"
                    >
                      📋 复制
                    </button>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    {inst.bitable_base_id ? (
                      <a
                        href={`https://bitable.feishu.cn/base/${inst.bitable_base_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--success-color)',
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '12px',
                        }}
                        title={`打开多维表格: ${inst.bitable_base_id}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 3h18v18H3z"/>
                          <path d="M3 9h18"/>
                          <path d="M3 15h18"/>
                          <path d="M9 3v18"/>
                        </svg>
                        已配置
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>—</span>
                    )}
                  </td>
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
                    <button
                      className={`btn ${inst.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                      style={{ padding: '4px 8px', marginRight: '4px', fontSize: '11px' }}
                      onClick={() => handleToggleStatus(inst)}
                    >
                      {inst.status === 'active' ? '⏸ 冻结' : '▶ 启动'}
                    </button>
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
                        <label className="form-label">激活码 {formData.activation_code || isUnlimited ? '' : '*'}</label>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                          <input
                            type="text"
                            className="form-input"
                            value={formData.activation_code}
                            onChange={e => {
                              setFormData({ ...formData, activation_code: e.target.value });
                              setActivationCodeInfo(null);
                              setIsUnlimited(false);
                            }}
                            placeholder="输入激活码或快速生成"
                            disabled={isUnlimited}
                            required={!formData.activation_code && !isUnlimited}
                            style={{ flex: 1, opacity: isUnlimited ? 0.5 : 1 }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <select
                              value={selectedDuration}
                              onChange={e => setSelectedDuration(Number(e.target.value))}
                              disabled={isUnlimited}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-color)',
                                fontSize: '12px',
                                minWidth: '100px',
                                opacity: isUnlimited ? 0.5 : 1,
                              }}
                            >
                              <option value={30}>1个月</option>
                              <option value={90}>3个月</option>
                              <option value={180}>6个月</option>
                              <option value={365}>1年</option>
                              <option value={730}>2年</option>
                            </select>
                            <button
                              type="button"
                              onClick={handleGenerateActivationCode}
                              disabled={generatingCode || isUnlimited}
                              style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'var(--primary-color)',
                                color: '#fff',
                                fontSize: '12px',
                                cursor: (generatingCode || isUnlimited) ? 'not-allowed' : 'pointer',
                                opacity: (generatingCode || isUnlimited) ? 0.6 : 1,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {generatingCode ? '生成中...' : '⚡ 快速生成'}
                            </button>
                          </div>
                        </div>
                        {activationCodeInfo && (
                          <div style={{ fontSize: '12px', color: 'var(--success-color)', marginTop: '4px' }}>
                            ✓ {isUnlimited ? '永久授权' : `激活码有效，可开通 ${activationCodeInfo.duration_days} 天`}（至 {formatDate(activationCodeInfo.expires_at)}）
                          </div>
                        )}
                        {/* Unlimited option */}
                        <div style={{ marginTop: '12px', padding: '10px', background: isUnlimited ? 'rgba(76, 175, 80, 0.1)' : 'var(--bg-color)', borderRadius: '8px', border: isUnlimited ? '1px solid var(--success-color)' : '1px solid transparent' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={isUnlimited}
                              onChange={handleSetUnlimited}
                              style={{ width: '16px', height: '16px' }}
                            />
                            <span style={{ fontWeight: 500, color: isUnlimited ? 'var(--success-color)' : 'inherit' }}>
                              🌟 永久授权（超级管理员专属）
                            </span>
                          </label>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '24px', marginTop: '4px' }}>
                            勾选后该校区服务永不到期，无需激活码
                          </div>
                        </div>
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
                    <label className="form-label">飞书 App Secret {editing && <span style={{ fontWeight: 400, fontSize: '12px' }}>(留空则不修改)</span>}</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type={showSecret ? 'text' : 'password'}
                        className="form-input"
                        value={formData.feishu_app_secret}
                        onChange={e => setFormData({ ...formData, feishu_app_secret: e.target.value })}
                        placeholder={editing ? '不修改请留空' : '请输入 App Secret'}
                        required={!editing}
                        style={{ flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        style={{
                          background: 'var(--bg-color)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '6px',
                          padding: '8px 12px',
                          cursor: 'pointer',
                          fontSize: '14px',
                        }}
                        title={showSecret ? '隐藏密码' : '显示密码'}
                      >
                        {showSecret ? '👁' : '👁‍🗨'}
                      </button>
                    </div>
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
                    <label className="form-label">多维表格链接</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.bitable_base_id}
                      onChange={e => {
                        setFormData({ ...formData, bitable_base_id: e.target.value });
                        setBitableTestStatus('idle');
                        setBitableTestPassed(false);
                      }}
                      placeholder="粘贴飞书多维表格链接（支持 wiki 或 base 格式）"
                    />
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      支持格式：/base/BcBSbPuA1a8s9rsfgoTcRMRTnSe 或 /wiki/P8QHw31S5iMDLfkIRfMcq3Dynnb
                    </div>
                  </div>

                  {/* Test Connection Button */}
                  <div className="form-group">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!formData.bitable_base_id.trim()) {
                          setBitableTestStatus('error');
                          setBitableTestMessage('请先输入多维表格链接');
                          return;
                        }
                        if (!formData.feishu_app_id || !formData.feishu_app_secret) {
                          setBitableTestStatus('error');
                          setBitableTestMessage('请先在步骤2中填写飞书 App ID 和 Secret');
                          return;
                        }
                        setBitableTestStatus('testing');
                        setBitableTestMessage('正在测试连接...');
                        try {
                          const result = await testBitableConnection(
                            formData.feishu_app_id,
                            formData.feishu_app_secret,
                            formData.bitable_base_id
                          );
                          if (result.success) {
                            setBitableTestStatus('success');
                            const matched = result.matched_table_ids || {};
                            const matchedCount = Object.keys(matched).length;
                            setBitableTestMessage(result.message || `连接成功，找到 ${result.tables_count} 个数据表，自动识别 ${matchedCount} 个业务表`);
                            setBitableTestPassed(true);

                            // Auto-fill matched table IDs and save all tables map
                            setFormData(prev => ({
                              ...prev,
                              bitable_sign_record_table_id: matched.bitable_sign_record_table_id || prev.bitable_sign_record_table_id,
                              bitable_schedule_table_id: matched.bitable_schedule_table_id || prev.bitable_schedule_table_id,
                              bitable_student_table_id: matched.bitable_student_table_id || prev.bitable_student_table_id,
                              // Always save all_tables_map when available, regardless of matched results
                              bitable_tables: result.all_tables_map ? JSON.stringify(result.all_tables_map) : prev.bitable_tables,
                            }));
                          } else {
                            setBitableTestStatus('error');
                            setBitableTestMessage(result.error || '连接失败');
                            setBitableTestPassed(false);
                          }
                        } catch (err) {
                          setBitableTestStatus('error');
                          setBitableTestMessage('测试请求失败，请检查网络');
                          setBitableTestPassed(false);
                        }
                      }}
                      disabled={bitableTestStatus === 'testing'}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '6px',
                        border: bitableTestStatus === 'success' ? '1px solid var(--success-color)' : '1px solid var(--border-color)',
                        background: bitableTestStatus === 'success' ? 'rgba(76, 175, 80, 0.1)' : 'var(--bg-color)',
                        color: bitableTestStatus === 'success' ? 'var(--success-color)' : 'var(--text-color)',
                        fontSize: '14px',
                        cursor: bitableTestStatus === 'testing' ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      {bitableTestStatus === 'testing' ? (
                        '🔄 测试中...'
                      ) : bitableTestStatus === 'success' ? (
                        '✓ 已连接'
                      ) : bitableTestStatus === 'error' ? (
                        '✗ 重试测试'
                      ) : (
                        '🔗 测试连接'
                      )}
                    </button>

                    {/* Test Result Feedback */}
                    {bitableTestMessage && (
                      <div style={{
                        marginTop: '8px',
                        padding: '10px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        background: bitableTestStatus === 'success' ? 'rgba(76, 175, 80, 0.1)' :
                                   bitableTestStatus === 'error' ? 'rgba(244, 67, 54, 0.1)' : 'var(--bg-color)',
                        color: bitableTestStatus === 'success' ? 'var(--success-color)' :
                               bitableTestStatus === 'error' ? '#f44336' : 'var(--text-secondary)',
                        border: bitableTestStatus === 'success' ? '1px solid var(--success-color)' :
                                bitableTestStatus === 'error' ? '1px solid #f44336' : '1px solid transparent',
                      }}>
                        {bitableTestMessage}
                      </div>
                    )}
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

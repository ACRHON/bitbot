/**
 * Admin Registration Page
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('两次密码输入不一致');
      return;
    }

    if (password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, name }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '注册失败');
      }

      navigate('/admin/login');
    } catch (err: any) {
      setError(err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-color)',
    }}>
      <div className="card" style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
            bitbot
          </h1>
          <p className="text-secondary">注册管理员账号</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">姓名</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px' }}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="请输入姓名"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">用户名</label>
            <input
              type="text"
              className="form-input"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px' }}
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">密码</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '50px', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px' }}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="请输入密码（至少6位）"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--primary-color)',
                  fontSize: '14px',
                }}
              >
                {showPassword ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">确认密码</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                className="form-input"
                style={{ width: '100%', paddingRight: '50px', padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '14px' }}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--primary-color)',
                  fontSize: '14px',
                }}
              >
                {showConfirmPassword ? '隐藏' : '显示'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: 'rgba(245, 63, 63, 0.1)',
              borderRadius: '6px',
              marginBottom: '16px',
              color: 'var(--danger-color)',
              fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', padding: '12px' }}
          >
            {loading ? '注册中...' : '注册'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <a href="/admin/login" style={{ color: 'var(--primary-color)', fontSize: '14px' }}>
              已有账号？去登录
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterPage;

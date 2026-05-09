/**
 * Activation Codes Management Page
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { ActivationCode, batchGenerateActivationCode, listActivationCodes, listActivationBatches, deleteActivationCode, deleteActivationCodeBatch } from '../lib/api';

type StatusFilter = 'all' | 'unused' | 'used' | 'expired';

const ActivationCodesPage: React.FC = () => {
  useAuth();
  const [codes, setCodes] = useState<ActivationCode[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copying, setCopying] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [batchFilter, setBatchFilter] = useState<string>('');

  // Generate form
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateDuration, setGenerateDuration] = useState(365);
  const [generateBatch, setGenerateBatch] = useState('');

  // Batch delete modal
  const [showBatchDelete, setShowBatchDelete] = useState(false);
  const [batchDeleteTarget, setBatchDeleteTarget] = useState<{ name: string; unused: number; total: number } | null>(null);

  const fetchCodes = useCallback(async () => {
    try {
      setError(null);
      const data = await listActivationCodes(
        batchFilter || undefined,
        statusFilter === 'all' ? undefined : statusFilter
      );
      setCodes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch codes:', err);
      setError('加载失败，请刷新重试');
      setCodes([]);
    }
  }, [batchFilter, statusFilter]);

  const fetchBatches = useCallback(async () => {
    try {
      const data = await listActivationBatches();
      setBatches(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch batches:', err);
      setBatches([]);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCodes(), fetchBatches()]);
    setLoading(false);
  }, [fetchCodes, fetchBatches]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Calculate stats from current codes
  const stats = {
    total: codes.length,
    unused: codes.filter(c => !c.used && c.expires_at > Date.now()).length,
    used: codes.filter(c => c.used).length,
    expired: codes.filter(c => !c.used && c.expires_at <= Date.now()).length,
  };

  const handleGenerate = async () => {
    if (generateDuration < 1) {
      alert('天数必须大于0');
      return;
    }
    setLoading(true);
    setGenerating(true);
    try {
      const result = await batchGenerateActivationCode(generateCount, generateDuration, generateBatch || undefined);
      setShowGenerate(false);
      resetGenerateForm();
      await fetchAll();
      // Show generated codes
      const codeList = result.codes.map((c: ActivationCode) => c.code).join('\n');
      alert(`生成成功！\n数量: ${result.count}\n激活码:\n${codeList}`);
    } catch (err) {
      alert('生成失败，请重试');
    } finally {
      setGenerating(false);
      setLoading(false);
    }
  };

  const resetGenerateForm = () => {
    setGenerateCount(10);
    setGenerateDuration(365);
    setGenerateBatch('');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个激活码吗？')) return;
    try {
      await deleteActivationCode(id);
      await fetchCodes();
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleDeleteBatch = async (batchName: string, unused: number, total: number) => {
    setBatchDeleteTarget({ name: batchName, unused, total });
    setShowBatchDelete(true);
  };

  const confirmDeleteBatch = async (force: boolean) => {
    if (!batchDeleteTarget) return;
    try {
      const result = await deleteActivationCodeBatch(batchDeleteTarget.name, force);
      if (result.success) {
        alert(`删除成功，共删除 ${result.deleted} 个激活码`);
        setShowBatchDelete(false);
        setBatchDeleteTarget(null);
        await fetchAll();
      } else {
        alert('删除失败');
      }
    } catch (err) {
      alert('删除失败，请重试');
    }
  };

  const handleCopy = async (code: ActivationCode) => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopying(code.id);
      setTimeout(() => setCopying(null), 1500);
    } catch {
      alert('复制失败');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('zh-CN');
  };

  const getStatus = (code: ActivationCode) => {
    if (code.used) return { label: '已使用', class: 'badge-secondary' };
    if (code.expires_at < Date.now()) return { label: '已过期', class: 'badge-danger' };
    return { label: '未使用', class: 'badge-success' };
  };

  const canDelete = (code: ActivationCode) => {
    return !code.used;
  };

  const statusTabs: { key: StatusFilter; label: string; count: number; color: string }[] = [
    { key: 'all', label: '全部', count: stats.total, color: 'var(--primary-color)' },
    { key: 'unused', label: '未使用', count: stats.unused, color: 'var(--success-color)' },
    { key: 'used', label: '已使用', count: stats.used, color: '#999' },
    { key: 'expired', label: '已过期', count: stats.expired, color: 'var(--danger-color)' },
  ];

  // Group codes by batch
  const groupedCodes = codes.reduce((acc, code) => {
    const batch = code.batch_name || '默认批次';
    if (!acc[batch]) acc[batch] = [];
    acc[batch].push(code);
    return acc;
  }, {} as Record<string, ActivationCode[]>);

  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  // Expand all batches by default when codes change
  useEffect(() => {
    setExpandedBatches(new Set(Object.keys(groupedCodes)));
  }, [codes]);

  const toggleBatch = (batch: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batch)) {
        next.delete(batch);
      } else {
        next.add(batch);
      }
      return next;
    });
  };

  return (
    <div>
      <div className="page-header flex flex-between">
        <h1 className="page-title">激活码管理</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={fetchAll} disabled={loading}>
            {loading ? '刷新中...' : '刷新'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>
            + 批量生成
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card mb-16" style={{ background: 'rgba(255, 59, 48, 0.1)', border: '1px solid var(--danger-color)' }}>
          <div style={{ color: 'var(--danger-color)', textAlign: 'center', padding: '12px' }}>
            {error}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        {statusTabs.map(tab => (
          <div
            key={tab.key}
            className="card"
            style={{
              padding: '16px',
              textAlign: 'center',
              cursor: 'pointer',
              border: statusFilter === tab.key ? `2px solid ${tab.color}` : '1px solid var(--border-color)',
              transition: 'all 0.2s',
            }}
            onClick={() => setStatusFilter(tab.key)}
          >
            <div style={{ fontSize: '28px', fontWeight: 700, color: tab.color }}>
              {tab.count}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {tab.label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card mb-16">
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">批次筛选</label>
            <select
              className="form-input"
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="">全部批次</option>
              {batches.map(batch => (
                <option key={batch} value={batch}>{batch}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => { setBatchFilter(''); setStatusFilter('all'); }}
          >
            重置筛选
          </button>
          <div style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-secondary)' }}>
            当前筛选结果：{codes.length} 个激活码
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="card">
          <div className="loading">加载中...</div>
        </div>
      ) : codes.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <p className="text-secondary">
              {statusFilter !== 'all' || batchFilter
                ? '当前筛选条件下没有激活码'
                : '暂无激活码，请点击"批量生成"创建'}
            </p>
          </div>
        </div>
      ) : (
        Object.entries(groupedCodes).map(([batch, batchCodes]) => {
          const unusedCount = batchCodes.filter(c => !c.used && c.expires_at > Date.now()).length;
          const hasDeletable = unusedCount > 0;
          return (
            <div key={batch} className="card mb-16">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  cursor: 'pointer',
                  padding: '12px',
                  background: 'var(--bg-color)',
                  borderRadius: '8px',
                  marginBottom: expandedBatches.has(batch) ? '12px' : 0,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}
                  onClick={() => toggleBatch(batch)}
                >
                  <span style={{ fontSize: '16px' }}>{expandedBatches.has(batch) ? '▼' : '▶'}</span>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>
                    {batch || '默认批次'}
                  </h3>
                  <span className="badge badge-secondary">{batchCodes.length}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    未使用: {unusedCount}
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    已使用: {batchCodes.filter(c => c.used).length}
                  </span>
                  {hasDeletable && (
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleDeleteBatch(batch, unusedCount, batchCodes.length); }}
                      style={{ marginLeft: '8px' }}
                    >
                      删除批次
                    </button>
                  )}
                </div>
              </div>

              {expandedBatches.has(batch) && (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>激活码</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>天数</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>到期时间</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>状态</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>使用信息</th>
                        <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchCodes.map((code) => {
                        const status = getStatus(code);
                        return (
                          <tr key={code.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ padding: '10px 8px' }}>
                              <code style={{
                                fontFamily: 'monospace',
                                fontSize: '13px',
                                background: 'var(--bg-color)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                display: 'inline-block',
                              }}>
                                {code.code}
                              </code>
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: '13px' }}>
                              {code.duration_days} 天
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: '13px' }}>
                              {formatDate(code.expires_at)}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              <span className={`badge ${status.class}`}>{status.label}</span>
                            </td>
                            <td style={{ padding: '10px 8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {code.used_at ? (
                                <div>
                                  <div>使用时间: {formatDate(code.used_at)}</div>
                                  {code.used_by && <div>使用者: {code.used_by}</div>}
                                </div>
                              ) : '-'}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                <button
                                  className={`btn btn-sm ${copying === code.id ? 'btn-success' : 'btn-secondary'}`}
                                  style={{ minWidth: '60px' }}
                                  onClick={() => handleCopy(code)}
                                >
                                  {copying === code.id ? '已复制' : '复制'}
                                </button>
                                {canDelete(code) && (
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(code.id)}
                                  >
                                    删除
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Generate Modal */}
      {showGenerate && (
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
          <div className="card" style={{ width: '100%', maxWidth: '440px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>
              批量生成激活码
            </h2>
            <div className="form-group">
              <label className="form-label">生成数量</label>
              <select
                className="form-input"
                value={generateCount}
                onChange={e => setGenerateCount(parseInt(e.target.value))}
                style={{ width: '100%' }}
              >
                <option value={1}>1 个</option>
                <option value={5}>5 个</option>
                <option value={10}>10 个</option>
                <option value={20}>20 个</option>
                <option value={50}>50 个</option>
                <option value={100}>100 个</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">有效天数</label>
              <input
                type="number"
                className="form-input"
                value={generateDuration}
                onChange={e => setGenerateDuration(parseInt(e.target.value) || 365)}
                min={1}
                max={3650}
                style={{ width: '100%' }}
              />
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                到期时间: {new Date(Date.now() + generateDuration * 24 * 60 * 60 * 1000).toLocaleDateString('zh-CN')}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">批次名称（可选）</label>
              <input
                type="text"
                className="form-input"
                value={generateBatch}
                onChange={e => setGenerateBatch(e.target.value)}
                placeholder="如：2026年4月批次"
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => { setShowGenerate(false); resetGenerateForm(); }}>
                取消
              </button>
              <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
                {generating ? '生成中...' : '生成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Delete Modal */}
      {showBatchDelete && batchDeleteTarget && (
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
          <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
              删除批次 "{batchDeleteTarget.name || '默认批次'}"
            </h2>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                <div style={{ flex: 1, padding: '12px', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--success-color)' }}>{batchDeleteTarget.unused}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>未使用</div>
                </div>
                <div style={{ flex: 1, padding: '12px', background: 'var(--bg-color)', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#999' }}>{batchDeleteTarget.total - batchDeleteTarget.unused}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>已使用</div>
                </div>
              </div>
              <div style={{ background: 'rgba(255, 59, 48, 0.1)', padding: '12px', borderRadius: '8px', fontSize: '13px', color: 'var(--danger-color)' }}>
                删除操作不可恢复，请谨慎操作
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                className="btn btn-danger"
                onClick={() => confirmDeleteBatch(false)}
              >
                仅删除未使用的 ({batchDeleteTarget.unused} 个)
              </button>
              <button
                className="btn btn-danger"
                onClick={() => confirmDeleteBatch(true)}
                style={{ background: '#d32f2f' }}
              >
                删除全部 ({batchDeleteTarget.total} 个，包含已使用)
              </button>
              <button className="btn btn-secondary" onClick={() => { setShowBatchDelete(false); setBatchDeleteTarget(null); }}>
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActivationCodesPage;
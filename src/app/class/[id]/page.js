'use client';

import { useState, useEffect, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import './classhome.css';

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultClearDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};

export default function ClassHomePage({ params }) {
  const router = useRouter();
  const { id: classId } = use(params);

  const [className, setClassName] = useState('加载中...');
  const [studentCount, setStudentCount] = useState(0);
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 清理功能相关状态
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [clearDate, setClearDate] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [clearStatus, setClearStatus] = useState('idle'); // 'idle' | 'success' | 'error'
  const [clearErrorMessage, setClearErrorMessage] = useState('');

  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationText, setNavigationText] = useState('');

  // 组件挂载状态与 Ref，防组件卸载后调用 setState/alert/router
  const isMountedRef = useRef(true);

  // 编辑班级相关状态与 Ref
  const fileInputRef = useRef(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editClassName, setEditClassName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchClassDetails = useCallback(async () => {
    try {
      const res = await api.get(`/api/classes/${classId}`);
      if (isMountedRef.current) {
        setClassName(res.data.name);
        setStudentCount(res.data.students ? res.data.students.length : 0);
      }
    } catch (error) {
      console.error('获取班级详情失败:', error);
      if (isMountedRef.current) {
        alert('获取数据失败，请稍后重试');
        router.push('/classes');
      }
    }
  }, [classId, router]);

  const checkTodayStatus = useCallback(async () => {
    try {
      const today = getTodayDateString();
      const res = await api.get(`/api/attendance/check-status?classId=${classId}&date=${today}`);
      setIsSubmittedToday(!!res.data.submitted);
    } catch (error) {
      console.error('获取今日签到状态失败:', error);
    }
  }, [classId]);

  useEffect(() => {
    if (!classId) return;

    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (isMounted) {
          await Promise.all([fetchClassDetails(), checkTodayStatus()]);
        }
      } catch (error) {
        console.error('获取班级数据失败:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
      isMountedRef.current = false;
    };
  }, [classId, fetchClassDetails, checkTodayStatus]);

  const goBack = () => {
    router.push('/classes');
  };

  const startCheckIn = () => {
    setIsNavigating(true);
    setNavigationText('正在载入签到页面...');
    router.push(`/class/${classId}/checkin`);
  };

  const queryRecords = () => {
    setIsNavigating(true);
    setNavigationText('正在载入查询报表...');
    router.push(`/class/${classId}/query`);
  };

  const openClearModal = () => {
    setClearStatus('idle');
    setClearDate(getDefaultClearDate());
    setIsClearModalOpen(true);
  };

  const handleCloseClearModal = () => {
    setIsClearModalOpen(false);
    if (clearStatus === 'success') {
      checkTodayStatus();
    }
  };

  const handleClearRecords = async () => {
    setIsClearing(true);
    setClearStatus('idle');
    try {
      await api.post('/api/attendance/clear', { classId, date: clearDate });
      setClearStatus('success');
    } catch (error) {
      console.error('清理签到数据失败:', error);
      setClearStatus('error');
      setClearErrorMessage(error.response?.data?.error || error.message || '未知错误');
    } finally {
      setIsClearing(false);
    }
  };

  const openEditDrawer = () => {
    setEditClassName(className);
    setSelectedFile(null);
    setUploadError('');
    setIsDrawerOpen(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const closeEditDrawer = () => {
    setIsDrawerOpen(false);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        setUploadError('请选择 .xlsx 或 .xls 格式的文件');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (file.size > 500 * 1024) {
        setUploadError('文件大小不能超过 500KB');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleSaveClass = async () => {
    if (!editClassName.trim()) {
      setUploadError('请输入班级名称');
      return;
    }

    setUploadError('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('name', editClassName.trim());
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    try {
      await api.put(`/api/classes/${classId}`, formData);
      closeEditDrawer();
      await fetchClassDetails();
    } catch (error) {
      console.error('Failed to update class:', error);
      const errMsg = error.response?.data?.error || '修改班级失败，请检查文件格式及网络';
      setUploadError(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="class-home-container">
      {/* 头部导航 */}
      <header className="header glass-panel">
        <button className="back-btn" onClick={goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>班级列表</span>
        </button>
        <span className="header-title">班级工作台</span>
        <div style={{ width: '76px' }}></div> {/* 占位保持居中 */}
      </header>

      {/* 加载中状态 */}
      {isLoading ? (
        <div className="loading-state glass-panel animate-fade-in">
          <div className="spinner"></div>
          <p>正在加载班级数据...</p>
        </div>
      ) : (
        <main className="content-area">
          {/* 班级信息展示 */}
          <div className="class-info-card glass-panel animate-fade-in">
            <div className="class-badge">班</div>
            <h1 className="class-name">{className}</h1>
            <div className="student-meta">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              <span>学生总数: {studentCount} 名</span>
            </div>
          </div>

          {/* 操作按钮区域 */}
          <div className="action-buttons animate-fade-in-delayed">
            {/* 开始今日签到 */}
            <button className="action-card-btn checkin-btn glass-panel" onClick={startCheckIn}>
              <div className="btn-icon checkin-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div className="btn-text">
                <h3>签到</h3>
                <p>{isSubmittedToday ? '今日已签到，可点击重新签到覆盖' : '按顺序快速为班级学生进行考勤签到'}</p>
              </div>
              <div className="btn-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </button>

            {/* 签到记录查询 */}
            <button className="action-card-btn query-btn glass-panel" onClick={queryRecords}>
              <div className="btn-icon query-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </div>
              <div className="btn-text">
                <h3>查询</h3>
                <p>查询与统计本班级历史出勤记录和明细</p>
              </div>
              <div className="btn-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </button>

            {/* 签到记录清理 */}
            <button className="action-card-btn clear-btn glass-panel" onClick={openClearModal}>
              <div className="btn-icon clear-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </div>
              <div className="btn-text">
                <h3>清理</h3>
                <p>清理指定日期之前的历史签到数据</p>
              </div>
              <div className="btn-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </button>

            {/* 编辑班级 */}
            <button className="action-card-btn edit-btn glass-panel" onClick={openEditDrawer}>
              <div className="btn-icon edit-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9"></path>
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                </svg>
              </div>
              <div className="btn-text">
                <h3>编辑</h3>
                <p>修改班级名称和重新上传班级学生花名册</p>
              </div>
              <div className="btn-arrow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </button>
          </div>

          {/* 清理弹窗 Modal */}
          {isClearModalOpen && (
            <div className="modal-overlay animate-fade-in" onClick={() => !isClearing && handleCloseClearModal()}>
              <div className="modal-content glass-panel animate-scale-up" onClick={(e) => e.stopPropagation()}>
                {clearStatus === 'idle' && (
                  <>
                    <div className="modal-header">
                      <span className="modal-title warning-text">⚠️ 危险操作：数据清理</span>
                      <button className="close-btn" onClick={handleCloseClearModal} disabled={isClearing}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    </div>
                    <div className="modal-body">
                      <p className="warning-desc">此操作将永久删除当前班级在所选日期（含）之前的所有历史打卡记录，数据删除后无法恢复！</p>
                      <div className="form-group">
                        <label className="form-label">截止日期：</label>
                        <input 
                          type="date" 
                          value={clearDate} 
                          max={getTodayDateString()} 
                          onChange={(e) => setClearDate(e.target.value)} 
                          className="modal-date-input"
                          disabled={isClearing}
                        />
                        <span className="tip-text">此日期（含）之前的记录将被彻底清除</span>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button className="modal-btn cancel-btn" onClick={handleCloseClearModal} disabled={isClearing}>取消</button>
                      <button 
                        className="modal-btn confirm-btn danger" 
                        onClick={handleClearRecords} 
                        disabled={isClearing}
                      >
                        {isClearing ? '正在清理...' : '确认删除'}
                      </button>
                    </div>
                  </>
                )}

                {clearStatus === 'success' && (
                  <>
                    <div className="modal-header">
                      <span className="modal-title success-text">✅ 清理成功</span>
                    </div>
                    <div className="modal-body">
                      <p className="status-desc">所选日期 <strong>{clearDate}</strong>（含）之前的签到记录已成功清理完成。</p>
                    </div>
                    <div className="modal-footer">
                      <button className="modal-btn confirm-btn" onClick={handleCloseClearModal}>我知道了</button>
                    </div>
                  </>
                )}

                {clearStatus === 'error' && (
                  <>
                    <div className="modal-header">
                      <span className="modal-title error-text">❌ 清理失败</span>
                    </div>
                    <div className="modal-body">
                      <p className="status-desc">清理数据时发生错误：</p>
                      <p className="error-message-box">{clearErrorMessage}</p>
                    </div>
                    <div className="modal-footer">
                      <button className="modal-btn cancel-btn" onClick={() => setClearStatus('idle')}>返回重试</button>
                      <button className="modal-btn confirm-btn danger" onClick={handleCloseClearModal}>关闭</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      )}

      {/* iOS 风格半屏抽屉 (Bottom Sheet) */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={() => !isUploading && closeEditDrawer()}></div>

      <div className={`drawer-container glass-panel ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <button className="drawer-text-btn cancel" disabled={isUploading} onClick={closeEditDrawer}>取消</button>
          <span className="drawer-title">编辑班级</span>
          <button className="drawer-text-btn confirm" disabled={isUploading} onClick={handleSaveClass}>
            {isUploading ? '保存中' : '完成'}
          </button>
        </div>

        <div className="drawer-body">
          <div className="drawer-drag-bar"></div>

          {uploadError && (
            <div className="drawer-error">
              <span>{uploadError}</span>
            </div>
          )}

          <div className="drawer-form">
            <div className="drawer-input-group">
              <label>班级名称</label>
              <input
                value={editClassName}
                onChange={(e) => setEditClassName(e.target.value)}
                type="text"
                placeholder="例如：一年级一班"
                disabled={isUploading}
              />
            </div>

            <div className="drawer-input-group">
              <label>导入学生花名册 (.xlsx, .xls)</label>
              <div
                className={`file-upload-area ${selectedFile ? 'has-file' : ''}`}
                onClick={() => !isUploading && fileInputRef.current.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {!selectedFile ? (
                  <div className="upload-placeholder">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="17 8 12 3 7 8"></polyline>
                      <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                    <p>点击选择 Excel 文件 (可选)</p>
                  </div>
                ) : (
                  <div className="upload-selected">
                    <svg className="file-success-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="9" y1="15" x2="15" y2="15"></line>
                      <polyline points="12 12 12 18"></polyline>
                    </svg>
                    <p className="file-name">{selectedFile.name}</p>
                    <p className="file-size">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                )}
              </div>
              <p className="excel-tip">注意：Excel 文件必须包含 <strong>序号</strong> 和 <strong>姓名</strong> 两列。</p>
              <p className="excel-tip" style={{ color: 'var(--danger-color)', marginTop: '4px' }}>💡 注意：如需新增学生，请增加新序号；请勿修改原序号与姓名的对应关系，亦勿删除已有序号，以防历史签到数据丢失。</p>
            </div>
          </div>
        </div>
      </div>

      {/* 页面跳转 loading */}
      {isNavigating && (
        <div className="full-page-loading">
          <div className="spinner"></div>
          <p>{navigationText}</p>
        </div>
      )}
    </div>
  );
}

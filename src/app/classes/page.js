'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import './classes.css';

export default function ClassesPage() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [teacherName, setTeacherName] = useState('教师');
  const [classesList, setClassesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const isLimitReached = classesList.length >= 2;

  // 底部抽屉状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchClasses = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/classes');
      setClassesList(response.data);
    } catch (error) {
      console.error('Failed to fetch classes:', error);
      alert(error.response?.data?.error || '获取班级列表失败，请确认后端服务是否正常');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const initialize = () => {
      // 获取教师名称
      const storedName = localStorage.getItem('teacherName');
      if (storedName) {
        setTeacherName(storedName);
      }

      // 检测暗黑模式
      const darkTheme = document.documentElement.classList.contains('dark');
      setIsDark(darkTheme);

      fetchClasses();
    };

    const timer = setTimeout(initialize, 0);
    return () => clearTimeout(timer);
  }, []);

  const toggleTheme = () => {
    const newDark = !isDark;
    setIsDark(newDark);
    if (newDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('teacherName');
    router.push('/login');
  };

  const openDrawer = () => {
    setNewClassName('');
    setSelectedFile(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
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
        alert('文件大小不能超过 500KB');
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      setSelectedFile(file);
      setUploadError('');
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      setUploadError('请输入班级名称');
      return;
    }
    if (!selectedFile) {
      setUploadError('请选择 Excel 花名册文件');
      return;
    }

    setUploadError('');
    setIsUploading(true);

    const formData = new FormData();
    formData.append('name', newClassName.trim());
    formData.append('file', selectedFile);

    try {
      await api.post('/api/classes', formData);
      closeDrawer();
      await fetchClasses();
    } catch (error) {
      console.error('Failed to create class:', error);
      const errMsg = error.response?.data?.error || '创建班级失败，请检查文件格式及网络';
      setUploadError(errMsg);
      alert(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  const goToClass = (classId) => {
    setIsRedirecting(true);
    router.push(`/class/${classId}`);
  };

  return (
    <div className="classes-container">
      {/* 头部 Header */}
      <header className="header glass-panel">
        <div className="header-left">
          <span className="welcome-text">您好，</span>
          <span className="teacher-name">{teacherName} 老师</span>
        </div>
        <div className="header-right">
          <button className="icon-btn theme-btn" onClick={toggleTheme} title={isDark ? '切换到明亮模式' : '切换到暗黑模式'}>
            {isDark ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <button className="icon-btn logout-btn" onClick={handleLogout} title="退出登录">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
          <button className="icon-btn add-btn" onClick={openDrawer} disabled={isLimitReached} title={isLimitReached ? '已达创建上限 (2/2)' : '创建班级'}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="content-area">
        <div className="section-title">
          <h2>班级列表</h2>
          {classesList.length > 0 && (
            <span className={`count-badge ${isLimitReached ? 'limit-reached' : ''}`}>
              {isLimitReached ? '班级数已达上限 2/2' : `班级数量: ${classesList.length}/2`}
            </span>
          )}
        </div>

        {/* 加载中 */}
        {isLoading && classesList.length === 0 && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>正在获取班级数据...</p>
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && classesList.length === 0 && (
          <div className="empty-state glass-panel">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h3>暂无班级</h3>
            <p>点击右上角的 “+” 按钮导入学生名单，创建您的第一个班级。</p>
            <button className="action-btn" onClick={openDrawer} disabled={isLimitReached}>创建班级</button>
          </div>
        )}

        {/* 班级卡片列表 */}
        {classesList.length > 0 && (
          <div className="classes-grid">
            {classesList.map((item) => (
              <div key={item.id} className="class-card glass-panel" onClick={() => goToClass(item.id)}>
                <div className="class-card-header">
                  <div className="class-avatar">{item.name.charAt(0)}</div>
                  <div className="class-info">
                    <h3>{item.name}</h3>
                    <p className="student-count">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                      </svg>
                      <span>{item.studentCount} 名学生</span>
                    </p>
                  </div>
                </div>
                <div className="class-card-footer">
                  <span>开始签到</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* iOS 风格半屏抽屉 (Bottom Sheet) */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={closeDrawer}></div>

      <div className={`drawer-container glass-panel ${isDrawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <button className="drawer-text-btn cancel" onClick={closeDrawer}>取消</button>
          <span className="drawer-title">新建班级</span>
          <button className="drawer-text-btn confirm" disabled={isUploading} onClick={handleCreateClass}>
            {isUploading ? '导入中' : '完成'}
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
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
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
                    <p>点击选择 Excel 文件</p>
                  </div>
                ) : (
                  <div className="upload-selected">
                    <svg className="file-success-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#34C759" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            </div>
          </div>
        </div>
      </div>
      {isRedirecting && (
        <div className="full-page-loading">
          <div className="spinner"></div>
          <p>正在载入班级...</p>
        </div>
      )}
    </div>
  );
}

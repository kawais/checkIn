'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import './classhome.css';

export default function ClassHomePage({ params }) {
  const router = useRouter();
  const { id: classId } = use(params);

  const [className, setClassName] = useState('加载中...');
  const [studentCount, setStudentCount] = useState(0);
  const [isSubmittedToday, setIsSubmittedToday] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([fetchClassDetails(), checkTodayStatus()]);
      } catch (error) {
        console.error('获取班级数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [classId]);

  const fetchClassDetails = async () => {
    try {
      const res = await api.get(`/api/classes/${classId}`);
      setClassName(res.data.name);
      setStudentCount(res.data.students ? res.data.students.length : 0);
    } catch (error) {
      console.error('获取班级详情失败:', error);
      alert('获取数据失败，请稍后重试');
      router.push('/classes');
    }
  };

  const checkTodayStatus = async () => {
    try {
      const today = getTodayDateString();
      const res = await api.get(`/api/attendance/check-status?classId=${classId}&date=${today}`);
      setIsSubmittedToday(!!res.data.submitted);
    } catch (error) {
      console.error('获取今日签到状态失败:', error);
    }
  };

  const goBack = () => {
    router.push('/classes');
  };

  const startCheckIn = () => {
    router.push(`/class/${classId}/checkin`);
  };

  const queryRecords = () => {
    router.push(`/class/${classId}/query`);
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
          </div>
        </main>
      )}
    </div>
  );
}

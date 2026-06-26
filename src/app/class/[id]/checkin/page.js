'use client';

import { useState, useEffect, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import './checkin.css';

export default function CheckInPage({ params }) {
  const router = useRouter();
  const { id: classId } = use(params);

  const [className, setClassName] = useState('');
  const [students, setStudents] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [attendanceRecords, setAttendanceRecords] = useState([]); // 记录每位学生的签到状态: { studentId, name, seqNum, status: true/false }
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [checkInDate, setCheckInDate] = useState(getTodayDateString());

  useEffect(() => {
    fetchClassData();
  }, [classId]);

  const fetchClassData = async () => {
    try {
      const res = await api.get(`/api/classes/${classId}`);
      setClassName(res.data.name);
      // 按照 seqNum 升序排序
      const sortedStudents = (res.data.students || []).sort((a, b) => a.seqNum - b.seqNum);
      setStudents(sortedStudents);
      // 初始化签到记录
      setAttendanceRecords(new Array(sortedStudents.length).fill(null));
    } catch (error) {
      console.error('获取班级学生失败:', error);
      alert('获取班级学生失败，请重试');
      router.push(`/class/${classId}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 当前学生
  const currentStudent = useMemo(() => {
    if (currentIndex >= 0 && currentIndex < students.length) {
      return students[currentIndex];
    }
    return null;
  }, [currentIndex, students]);

  // 进度百分比
  const progressPercent = useMemo(() => {
    if (students.length === 0) return 0;
    return Math.round((currentIndex / students.length) * 100);
  }, [currentIndex, students]);

  const handleCheckIn = (status) => {
    if (!currentStudent) return;

    const updated = [...attendanceRecords];
    updated[currentIndex] = {
      studentId: currentStudent.id,
      name: currentStudent.name,
      seqNum: currentStudent.seqNum,
      status
    };
    setAttendanceRecords(updated);

    const nextIndex = currentIndex + 1;
    setCurrentIndex(nextIndex);

    // 如果全部签到完毕，打开确认抽屉
    if (nextIndex === students.length) {
      setIsDrawerOpen(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex === 0) return;
    setCurrentIndex(currentIndex - 1);
  };

  // 汇总统计数
  const stats = useMemo(() => {
    const total = students.length;
    const present = attendanceRecords.filter(r => r && r.status === true).length;
    const absent = total - present;
    return { total, present, absent };
  }, [attendanceRecords, students]);

  const submitAttendance = async () => {
    setIsSubmitting(true);
    try {
      const payload = {
        classId,
        date: checkInDate,
        attendance: attendanceRecords.map(r => ({
          studentId: r.studentId,
          status: r.status
        }))
      };

      await api.post('/api/attendance/submit', payload);
      setIsDrawerOpen(false);
      router.push(`/class/${classId}`);
    } catch (error) {
      console.error('提交考勤失败:', error);
      alert(error.response?.data?.error || '提交考勤失败，请检查网络');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelSubmit = () => {
    setIsDrawerOpen(false);
    // 退回到最后一个学生以便修改
    setCurrentIndex(students.length - 1);
  };

  const goBack = () => {
    setIsConfirmOpen(true);
  };

  const toggleRecordStatus = (index) => {
    const updated = [...attendanceRecords];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        status: !updated[index].status
      };
      setAttendanceRecords(updated);
    }
  };

  return (
    <div className="checkin-container">
      {/* 头部 Navigation */}
      <header className="header glass-panel">
        <button className="back-btn" onClick={goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>取消</span>
        </button>
        <span className="header-title">{className} 签到</span>
        <div style={{ width: '58px' }}></div>
      </header>

      {/* 签到日期选择 */}
      {!isLoading && students.length > 0 && (
        <div className="date-select-section glass-panel animate-fade-in">
          <label className="date-label">签到日期</label>
          <input type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} className="date-input" />
        </div>
      )}

      {/* 顶部进度条 */}
      {students.length > 0 && (
        <div className="progress-section animate-fade-in">
          <div className="progress-info">
            <span className="progress-text">签到进度</span>
            <span className="progress-count">{Math.min(currentIndex + 1, students.length)} / {students.length}</span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      )}

      {/* 加载中 */}
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>正在载入学生名单...</p>
        </div>
      ) : (
        <main className="checkin-main">
          <div className="card-wrapper">
            {currentStudent && (
              <div key={currentStudent.id} className="student-card glass-panel">
                <div className="card-glow"></div>
                <div className="student-seq">序号 {currentStudent.seqNum}</div>
                <h2 className="student-name">{currentStudent.name}</h2>
                <div className="status-indicator-placeholder">
                  {attendanceRecords[currentIndex] === null ? (
                    <span className="status-hint">等待考勤确认</span>
                  ) : attendanceRecords[currentIndex].status ? (
                    <span className="status-hint present-text">出勤</span>
                  ) : (
                    <span className="status-hint absent-text">缺勤</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 底部控制按钮 */}
          <div className="controls-section">
            {/* 上一步 */}
            {currentIndex > 0 ? (
              <button className="prev-btn animate-fade-in" onClick={handlePrev}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
                <span>上一步</span>
              </button>
            ) : (
              <div style={{ height: '36px' }}></div>
            )}

            {/* 签到主按键 */}
            <div className="main-buttons">
              {/* 否按钮 (缺勤) */}
              <button className="action-btn absent-btn" onClick={() => handleCheckIn(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span>缺勤 (否)</span>
              </button>

              {/* 是按钮 (出勤) */}
              <button className="action-btn present-btn" onClick={() => handleCheckIn(true)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>出勤 (是)</span>
              </button>
            </div>
          </div>
        </main>
      )}

      {/* iOS 风格半屏抽屉 (Bottom Sheet) */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={cancelSubmit}></div>

      <div className={`drawer-container glass-panel ${isDrawerOpen ? 'open' : ''}`}>
        {/* 抽屉头部 */}
        <div className="drawer-header">
          <button className="drawer-text-btn cancel" onClick={cancelSubmit}>修改</button>
          <span className="drawer-title">确认 {checkInDate} 考勤</span>
          <button className="drawer-text-btn confirm" disabled={isSubmitting} onClick={submitAttendance}>
            {isSubmitting ? '提交中' : '确认提交'}
          </button>
        </div>

        {/* 抽屉体部 */}
        <div className="drawer-body">
          <div className="drawer-drag-bar"></div>

          {/* 汇总统计 */}
          <div className="stats-grid">
            <div className="stat-card total">
              <span className="stat-num">{stats.total}</span>
              <span className="stat-label">应到人数</span>
            </div>
            <div className="stat-card present">
              <span className="stat-num">{stats.present}</span>
              <span className="stat-label">实到人数</span>
            </div>
            <div className="stat-card absent">
              <span className="stat-num">{stats.absent}</span>
              <span className="stat-label">缺勤人数</span>
            </div>
          </div>

          {/* 选择明细列表 */}
          <div className="records-list-wrapper">
            <h3 className="list-title">学生明细清单</h3>
            <div className="records-list">
              {attendanceRecords.map((record, index) => (
                <div key={index} className="record-item">
                  <span className="student-seq-badge">{record?.seqNum}</span>
                  <span className="student-name-text">{record?.name}</span>
                  <span
                    className={`status-tag ${record?.status ? 'present-tag' : 'absent-tag'}`}
                    onClick={() => toggleRecordStatus(index)}
                  >
                    {record?.status ? '出勤' : '缺勤'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="确认退出"
        message="确定要退出签到吗？当前进度不会保存。"
        confirmText="确定退出"
        cancelText="取消"
        type="danger"
        onConfirm={() => {
          setIsConfirmOpen(false);
          router.push(`/class/${classId}`);
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}

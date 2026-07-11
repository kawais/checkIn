'use client';

import { useState, useEffect, useMemo, use, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import './checkin.css';

export default function CheckInPage({ params }) {
  const router = useRouter();
  const { id: classId } = use(params);

  const [className, setClassName] = useState('');
  const [students, setStudents] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]); // 记录每位学生的签到状态: { studentId, name, seqNum, status: true/false }
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);

  const [editingRecord, setEditingRecord] = useState(null);
  const [tempRemark, setTempRemark] = useState('');
  const longPressTimerRef = useRef(null);
  const isLongPressActiveRef = useRef(false);
  const pressingStudentIdRef = useRef(null);

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [checkInDate, setCheckInDate] = useState(getTodayDateString());

  const fetchClassData = useCallback(async () => {
    try {
      const res = await api.get(`/api/classes/${classId}`);
      setClassName(res.data.name);
      // 按照 seqNum 升序排序
      const sortedStudents = (res.data.students || []).sort((a, b) => a.seqNum - b.seqNum);
      setStudents(sortedStudents);
      // 初始化签到记录，默认未点击均为未签到(false)
      const initialRecords = sortedStudents.map(student => ({
        studentId: student.id,
        name: student.name,
        seqNum: student.seqNum,
        status: false,
        remark: ''
      }));
      setAttendanceRecords(initialRecords);
    } catch (error) {
      console.error('获取班级学生失败:', error);
      alert('获取班级学生失败，请重试');
      router.push(`/class/${classId}`);
    } finally {
      setIsLoading(false);
    }
  }, [classId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchClassData();
  }, [classId, fetchClassData]);

  // 全选
  const handleSelectAll = () => {
    setAttendanceRecords(prev => prev.map(r => ({ ...r, status: true })));
  };

  // 反选
  const handleInvertSelection = () => {
    setAttendanceRecords(prev => prev.map(r => ({ ...r, status: !r.status })));
  };

  // 翻转单人签到状态
  const toggleStudentStatus = (studentId) => {
    setAttendanceRecords(prev =>
      prev.map(r => r.studentId === studentId ? { ...r, status: !r.status } : r)
    );
  };

  const handleTouchStart = (studentId) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    isLongPressActiveRef.current = false;
    pressingStudentIdRef.current = studentId;

    const el = document.getElementById(`student-card-${studentId}`);
    if (el) el.classList.add('pressing');

    longPressTimerRef.current = setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (el) el.classList.remove('pressing');
      
      const record = attendanceRecords.find(r => r.studentId === studentId);
      if (record) {
        setEditingRecord(record);
        setTempRemark(record.remark || '');
      }
    }, 2000);
  };

  const handleTouchEnd = (studentId) => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    const el = document.getElementById(`student-card-${studentId}`);
    if (el) el.classList.remove('pressing');
  };

  const handleCardClick = (studentId) => {
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }
    toggleStudentStatus(studentId);
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
          status: r.status,
          remark: r.remark || ''
        }))
      };

      await api.post('/api/attendance/submit', payload);
      setIsSubmitConfirmOpen(false);
      router.push(`/class/${classId}`);
    } catch (error) {
      console.error('提交考勤失败:', error);
      alert(error.response?.data?.error || '提交考勤失败，请检查网络');
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    setIsConfirmOpen(true);
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

      {/* 加载中 */}
      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>正在载入学生名单...</p>
        </div>
      ) : (
        <>
          <main className="checkin-main animate-fade-in">
            {/* 全局控制按钮 */}
            <div className="global-controls-section">
              <button className="control-btn" onClick={handleSelectAll}>全选</button>
              <button className="control-btn" onClick={handleInvertSelection}>反选</button>
            </div>

            {/* 学生网格平铺 */}
            <div className="student-grid-section">
              <div className="student-grid">
                {attendanceRecords.map((record) => (
                  <div
                    id={`student-card-${record.studentId}`}
                    key={record.studentId}
                    className={`student-btn-card ${record.status ? 'present' : ''}`}
                    onClick={() => handleCardClick(record.studentId)}
                    onMouseDown={() => handleTouchStart(record.studentId)}
                    onMouseUp={() => handleTouchEnd(record.studentId)}
                    onMouseLeave={() => handleTouchEnd(record.studentId)}
                    onTouchStart={() => handleTouchStart(record.studentId)}
                    onTouchEnd={() => handleTouchEnd(record.studentId)}
                  >
                    <span className="student-seq">{record.seqNum}</span>
                    <span className="student-name">{record.name}</span>
                    <svg className="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          </main>

          {/* 固定悬浮底部栏 */}
          <div className="sticky-bottom-bar animate-fade-in">
            <div className="stats-summary">
              <span className="stat-item present-count">已签到: {stats.present} 人</span>
              <span className="stat-item absent-count">未签到: {stats.absent} 人</span>
            </div>
            <button className="submit-btn" onClick={() => setIsSubmitConfirmOpen(true)} disabled={isSubmitting}>
              {isSubmitting ? '提交中' : '确认提交'}
            </button>
          </div>
        </>
      )}

      {isConfirmOpen && (
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
      )}

      {isSubmitConfirmOpen && (
        <ConfirmDialog
          isOpen={isSubmitConfirmOpen}
          title="确认提交"
          message={`确定要提交 ${checkInDate} 的考勤数据吗？`}
          confirmText="确定提交"
          cancelText="取消"
          type="primary"
          onConfirm={submitAttendance}
          onCancel={() => setIsSubmitConfirmOpen(false)}
        />
      )}
    </div>
  );
}

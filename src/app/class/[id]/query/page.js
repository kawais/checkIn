'use client';

import { useState, useEffect, useMemo, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/utils/api';
import './query.css';

export default function QueryPage({ params }) {
  const router = useRouter();
  const { id: classId } = use(params);

  const [className, setClassName] = useState('加载中...');
  const [studentsData, setStudentsData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [months, setMonths] = useState([]);

  // 默认日期：当月首日和今日
  const getFirstDayOfMonth = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}-01`;
  };

  const getTodayDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(getTodayDateString());

  // 缓存班级中学生的序号
  const [studentSeqMap, setStudentSeqMap] = useState({});

  // 个人明细抽屉状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  // 手势拖拽相关的状态与变量
  const [drawerOffsetY, setDrawerOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  // 获取班级详情，获取准确的序号和班级名称
  const fetchClassDetails = async () => {
    try {
      const res = await api.get(`/api/classes/${classId}`);
      setClassName(res.data.name);
      if (res.data.students) {
        const map = {};
        res.data.students.forEach(s => {
          map[s.id] = s.seqNum;
        });
        setStudentSeqMap(map);
      }
    } catch (error) {
      console.error('获取班级详情失败:', error);
    }
  };

  // 纯字符串的月份区间计算（规避时区偏移问题）
  const getMonthsInRange = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const startMatch = startStr.match(/^(\d{4})-(\d{2})/);
    const endMatch = endStr.match(/^(\d{4})-(\d{2})/);
    if (!startMatch || !endMatch) return [];

    const startYear = parseInt(startMatch[1], 10);
    const startMonth = parseInt(startMatch[2], 10);
    const endYear = parseInt(endMatch[1], 10);
    const endMonth = parseInt(endMatch[2], 10);

    const result = [];
    let y = startYear;
    let m = startMonth;

    while (y < endYear || (y === endYear && m <= endMonth)) {
      result.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return result;
  };

  // 获取考勤统计数据
  const fetchData = async () => {
    if (!startDate || !endDate) {
      alert('请选择开始和结束日期');
      return;
    }
    if (startDate > endDate) {
      alert('开始日期不能晚于结束日期');
      return;
    }

    setIsLoading(true);
    try {
      // 动态生成月份列
      setMonths(getMonthsInRange(startDate, endDate));

      const res = await api.get(`/api/attendance/query`, {
        params: {
          classId,
          startDate,
          endDate
        }
      });

      setStudentsData(res.data.students || []);
    } catch (error) {
      console.error('查询考勤数据失败:', error);
      alert(error.response?.data?.error || '查询失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuery = () => {
    fetchData();
  };

  const handleClear = () => {
    setStartDate(getFirstDayOfMonth());
    setEndDate(getTodayDateString());
  };

  // 解决当清除完日期后需要自动拉取数据
  useEffect(() => {
    if (classId) {
      fetchClassDetails();
      fetchData();
    }
  }, [classId, startDate, endDate]);

  const goBack = () => {
    router.push(`/class/${classId}`);
  };

  const showDetail = (student) => {
    setSelectedStudent(student);
    setIsDrawerOpen(true);
    setDrawerOffsetY(0);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  // 格式化表头的月份显示
  const formatMonthHeader = (monthStr) => {
    const parts = monthStr.split('-');
    const month = parseInt(parts[1], 10);
    return `${month}月`;
  };

  // 格式化明细日期
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const weekdayMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const weekday = weekdayMap[date.getDay()];

    return `${year}年${month}月${day}日 ${weekday}`;
  };

  // 按日期倒序排列明细
  const sortedRecords = useMemo(() => {
    if (!selectedStudent || !selectedStudent.records) return [];
    return [...selectedStudent.records].sort((a, b) => b.date.localeCompare(a.date));
  }, [selectedStudent]);

  // --- 手势下滑关闭逻辑 (iOS style) ---
  const onTouchStart = (e) => {
    const headerOrBar = e.target.closest('.drawer-header') || e.target.classList.contains('drawer-drag-bar');
    const listContainer = e.currentTarget.querySelector('.detail-list-wrapper');
    const isListAtTop = listContainer ? listContainer.scrollTop <= 0 : true;

    if (headerOrBar || isListAtTop) {
      setIsDragging(true);
      isDraggingRef.current = true;
      startYRef.current = e.touches[0].clientY;
      setDrawerOffsetY(0);
    }
  };

  const onTouchMove = (e) => {
    if (!isDraggingRef.current) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      if (e.cancelable) e.preventDefault();
      setDrawerOffsetY(diff);
    } else {
      setDrawerOffsetY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  };

  const onTouchEnd = () => {
    if (!isDraggingRef.current) return;
    setIsDragging(false);
    isDraggingRef.current = false;

    // 获取当前的 offset 进行判断
    setDrawerOffsetY(prev => {
      if (prev > 100) {
        closeDrawer();
        return 0;
      }
      return 0;
    });
  };

  // 鼠标操作逻辑
  const onMouseDown = (e) => {
    const headerOrBar = e.target.closest('.drawer-header') || e.target.classList.contains('drawer-drag-bar');
    const listContainer = e.currentTarget.querySelector('.detail-list-wrapper');
    const isListAtTop = listContainer ? listContainer.scrollTop <= 0 : true;

    if (headerOrBar || isListAtTop) {
      setIsDragging(true);
      isDraggingRef.current = true;
      startYRef.current = e.clientY;
      setDrawerOffsetY(0);

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };

  const onMouseMove = (e) => {
    if (!isDraggingRef.current) return;
    const currentY = e.clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      setDrawerOffsetY(diff);
    } else {
      setDrawerOffsetY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
    isDraggingRef.current = false;
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);

    setDrawerOffsetY(prev => {
      if (prev > 100) {
        closeDrawer();
        return 0;
      }
      return 0;
    });
  };

  // 注销时清理全局鼠标监听，防御内存泄漏
  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const drawerStyle = useMemo(() => {
    const styles = {};
    if (drawerOffsetY > 0) {
      styles.transform = `translate(-50%, ${drawerOffsetY}px)`;
      if (isDragging) {
        styles.transition = 'none';
      }
    }
    return styles;
  }, [drawerOffsetY, isDragging]);

  return (
    <div className="query-dashboard-container">
      {/* 头部导航 */}
      <header className="header glass-panel">
        <button className="back-btn" onClick={goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>班级工作台</span>
        </button>
        <span className="header-title">考勤明细查询</span>
        <div style={{ width: '76px' }}></div>
      </header>

      {/* 主体区域 */}
      <main className="content-area">
        {/* 班级概要 */}
        <div className="class-summary glass-panel animate-fade-in">
          <div className="summary-badge">查</div>
          <div className="summary-info">
            <h2>{className}</h2>
            <p>出勤统计与学生个人明细报表</p>
          </div>
        </div>

        {/* 过滤面板 */}
        <div className="filter-panel glass-panel animate-fade-in">
          <div className="filter-inputs">
            <div className="input-group">
              <label>开始日期</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="input-group">
              <label>结束日期</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          <div className="filter-actions">
            <button className="btn btn-clear glass-panel" onClick={handleClear}>清除</button>
            <button className="btn btn-query" onClick={handleQuery}>查询</button>
          </div>
        </div>

        {/* 加载状态 */}
        {isLoading ? (
          <div className="loading-state glass-panel animate-fade-in">
            <div className="spinner"></div>
            <p>正在获取考勤统计...</p>
          </div>
        ) : (
          <div className="report-panel glass-panel animate-fade-in-delayed">
            {studentsData.length === 0 ? (
              <div className="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="9" x2="15" y2="9"></line>
                  <line x1="9" y1="13" x2="15" y2="13"></line>
                  <line x1="9" y1="17" x2="15" y2="17"></line>
                </svg>
                <p>暂无符合条件的考勤记录</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="report-table">
                  <thead>
                    <tr>
                      <th className="col-seq">序号</th>
                      <th className="col-name">学生</th>
                      {months.map(month => (
                        <th key={month} className="col-month">
                          {formatMonthHeader(month)}
                        </th>
                      ))}
                      <th className="col-total">累计天数</th>
                      <th className="col-action">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsData.map((student, index) => (
                      <tr key={student.id}>
                        <td className="col-seq">{studentSeqMap[student.id] || index + 1}</td>
                        <td className="col-name font-semibold">{student.name}</td>
                        {months.map(month => (
                          <td key={month} className="col-month">
                            <span className="attendance-count">
                              {student.monthlyCounts[month] || 0}
                              <span className="unit">天</span>
                            </span>
                          </td>
                        ))}
                        <td className="col-total font-semibold">
                          <span className="total-badge">{student.totalCount || 0}天</span>
                        </td>
                        <td className="col-action">
                          <button className="action-link-btn" onClick={() => showDetail(student)}>详情</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* iOS style BottomSheet Drawer */}
      <div className={`drawer-overlay ${isDrawerOpen ? 'open' : ''}`} onClick={closeDrawer}></div>

      <div
        className={`drawer-container glass-panel ${isDrawerOpen ? 'open' : ''}`}
        style={drawerStyle}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        <div className="drawer-drag-bar"></div>
        <div className="drawer-header">
          <span className="drawer-title">{selectedStudent?.name} 的托管明细</span>
          <button className="drawer-close-btn" onClick={closeDrawer}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          <div className="date-range-sub">
            统计区间: {startDate} 至 {endDate}
          </div>
          {sortedRecords.length === 0 ? (
            <div className="empty-detail-state">
              <p>该期间内无打卡记录</p>
            </div>
          ) : (
            <div className="detail-list-wrapper">
              {sortedRecords.map(record => (
                <div key={record.date} className="detail-item">
                  <div className="detail-date">{formatDate(record.date)}</div>
                  <div className={`detail-status ${record.status ? 'status-present' : 'status-absent'}`}>
                    <span className="status-dot"></span>
                    <span>{record.status ? '已托管' : '未托管'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

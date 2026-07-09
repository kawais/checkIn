# 签到页面平铺式改版实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构签到页面，实现平铺式学生卡片网格，支持全选/反选、底部悬浮统计，以及直接提交的二次确认功能。

**Architecture:**
1. 修改 `src/app/class/[id]/checkin/page.js`：
   - 将原来的一位学生卡片状态机修改为全员平铺。
   - 初始化时将所有学生考勤记录均默认置为 `status: false`。
   - 增加全选/反选的状态处理逻辑。
   - 引入 `isSubmitConfirmOpen` 状态，控制提交确认弹窗。
   - 渲染全员平铺列表和底部固定定位的悬浮统计栏，接入自定义 `ConfirmDialog` 提交弹窗。
   - 移去已废弃的底端半屏抽屉 (drawer) DOM。
2. 修改 `src/app/class/[id]/checkin/checkin.css`：
   - 移除原来的单张卡片和左右切换按钮的样式。
   - 增加 `.student-grid` 网格排版样式。
   - 增加 `.student-btn-card`、已签到的激活态 `.present` 样式。
   - 增加 `.sticky-bottom-bar` 悬浮栏样式，包含磨砂玻璃质感和布局。
3. 修改 E2E 测试 `tests/e2e.spec.js`：
   - 重构第 6 步“点击签到按钮”交互：修改点击学生卡片的逻辑，去除了多步卡片切换，改为在网格里直接点击学生按钮签到，以及取消确认抽屉交互测试，直接测试二次提交弹窗。

**Tech Stack:** React, CSS, Playwright (E2E Testing)

---

### Task 1: 修改 CSS 样式文件

**Files:**
- Modify: `src/app/class/[id]/checkin/checkin.css`

**Step 1: 编写新版样式的 CSS 代码**
重置样式，移除废弃的左右按钮和单卡片样式，增加网格、平铺卡片和底部固定栏的样式。
具体代码：
```css
/* 学生网格平铺区域 */
.student-grid-section {
  flex: 1;
  padding: 8px 4px 100px 4px; /* 留出底部悬浮栏的空间 */
  overflow-y: auto;
}

.student-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.student-btn-card {
  height: 52px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

html.dark .student-btn-card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.05);
}

.student-btn-card:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.6);
}

html.dark .student-btn-card:hover {
  background: rgba(255, 255, 255, 0.08);
}

.student-btn-card:active {
  transform: scale(0.97);
}

/* 已签到激活态 */
.student-btn-card.present {
  background: #34C759;
  border-color: #30B34F;
  color: #FFFFFF;
  box-shadow: 0 4px 12px rgba(52, 199, 89, 0.2);
}

.student-btn-card.present .check-icon {
  display: flex;
  color: #FFFFFF;
}

.student-btn-card .check-icon {
  display: none;
}

.student-btn-card .student-seq {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.6;
  margin-right: 4px;
}

.student-btn-card .student-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* 全选/反选操作栏 */
.global-controls-section {
  display: flex;
  gap: 12px;
  padding: 4px;
  margin-bottom: 4px;
}

.control-btn {
  flex: 1;
  height: 38px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s;
}

html.dark .control-btn {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

.control-btn:hover {
  background: rgba(255, 255, 255, 0.9);
}

html.dark .control-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}

.control-btn:active {
  transform: scale(0.97);
}

/* 固定悬浮底部栏 */
.sticky-bottom-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 480px;
  padding: 16px 20px 24px 20px;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.03);
  z-index: 98;
}

html.dark .sticky-bottom-bar {
  background: rgba(28, 28, 30, 0.7);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.2);
}

.sticky-bottom-bar .stats-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  padding: 0 4px;
}

.stats-summary .stat-item.present-count {
  color: #34C759;
}

.stats-summary .stat-item.absent-count {
  color: var(--text-secondary);
}

.sticky-bottom-bar .submit-btn {
  height: 48px;
  border-radius: 14px;
  background: var(--primary-color);
  color: #FFFFFF;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 122, 255, 0.15);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.sticky-bottom-bar .submit-btn:hover {
  background: #0066D6;
}

.sticky-bottom-bar .submit-btn:active {
  transform: scale(0.98);
}
```

**Step 2: 提交 CSS 文件**
```bash
git add src/app/class/\[id\]/checkin/checkin.css
git commit -m "style: redesign check-in layout with flat student grid and sticky bottom bar"
```

---

### Task 2: 重构 React 签到逻辑与界面

**Files:**
- Modify: `src/app/class/[id]/checkin/page.js`

**Step 1: 重构 React 代码**
修改 `page.js`，包含：
1. 移除 `currentIndex` 等单卡片状态，新增 `isSubmitConfirmOpen` 状态。
2. 修改数据初始化，全部默认状态为 `status: false`。
3. 新增 `handleSelectAll`（一键全选）、`handleInvertSelection`（反转选择）、`toggleStudentStatus`（翻转单人状态）。
4. 渲染平铺 Grid 列表、全选反选操作栏、底部悬浮栏，以及接入两个 `ConfirmDialog`（退出确认 & 提交确认）。

具体 JSX 排布：
```javascript
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
        <main className="checkin-main animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
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
                  key={record.studentId}
                  className={`student-btn-card ${record.status ? 'present' : ''}`}
                  onClick={() => toggleStudentStatus(record.studentId)}
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

          {/* 固定悬浮底部栏 */}
          <div className="sticky-bottom-bar">
            <div className="stats-summary">
              <span className="stat-item present-count">已签到: {stats.present} 人</span>
              <span className="stat-item absent-count">未签到: {stats.absent} 人</span>
            </div>
            <button className="submit-btn" onClick={() => setIsSubmitConfirmOpen(true)}>
              确认提交
            </button>
          </div>
        </main>
      )}

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
    </div>
  );
```

**Step 2: 提交 React 组件更改**
```bash
git add src/app/class/\[id\]/checkin/page.js
git commit -m "feat: implement flat check-in grid, all-select/invert controls, and quick submit dialog"
```

---

### Task 3: 适配修改 E2E 测试代码

**Files:**
- Modify: `tests/e2e.spec.js`

**Step 1: 重构第 6 步考勤交互部分的测试脚本**
将原来点击 “ present-btn ”、“ absent-btn ” 等单人依次打卡逻辑，修改为直接在 `.student-grid` 内点击平铺的学生卡片，同时移除测试原本的二次确认抽屉弹窗断言，改用对 `ConfirmDialog` 提交弹窗的测试。
具体修改代码：
```javascript
    // 6. 点击签到按钮
    await page.click('button:has-text("签到")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/checkin/);

    // ====================================================
    // 6.1 织入自定义确认退出对话框 (ConfirmDialog) 交互验证
    // ====================================================
    const workbenchUrl = page.url().replace(/\/checkin$/, '');
    const exitOverlay = page.locator('.confirm-modal-overlay').first(); // 退出确认弹窗的 overlay

    // 点击返回按钮，拉起自定义退出确认弹窗
    await page.click('.back-btn');
    await expect(page.locator('#confirm-dialog-title')).toHaveText('确认退出');
    await expect(page.locator('#confirm-dialog-message')).toHaveText('确定要退出签到吗？当前进度不会保存。');

    // 测试取消按钮点击
    await page.click('#confirm-dialog-cancel-btn');
    expect(page.url()).toContain('/checkin'); // 仍在签到页

    // 重新点击返回并按 Escape 键取消弹窗
    await page.click('.back-btn');
    await page.keyboard.press('Escape');

    // 重新点击返回并通过点击遮罩层取消
    await page.click('.back-btn');
    await exitOverlay.click({ position: { x: 5, y: 5 } });

    // 测试确定按钮点击退出跳转
    await page.click('.back-btn');
    await page.click('#confirm-dialog-confirm-btn');
    
    // 验证弹窗关闭并成功返回工作台
    await page.waitForURL(workbenchUrl);
    expect(page.url()).toBe(workbenchUrl);

    // 重新点击“签到”按钮，再次进入签到页面以继续打卡
    await page.click('button:has-text("签到")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/checkin/);
    // ====================================================
    // ConfirmDialog 交互验证结束，继续签到提交
    // ====================================================

    // 点击第一位学生：学生甲 -> 出勤 (已签到)
    const studentA = page.locator('.student-btn-card:has-text("学生甲")');
    await studentA.click();
    await expect(studentA).toHaveClass(/present/); // 变为绿色已签到

    // 点击第二位学生：学生乙 -> 出勤 (已签到)
    const studentB = page.locator('.student-btn-card:has-text("学生乙")');
    await studentB.click();
    await expect(studentB).toHaveClass(/present/);

    // 第三位学生：学生丙 -> 保持未点击 (未签到)
    const studentC = page.locator('.student-btn-card:has-text("学生丙")');
    await expect(studentC).not.toHaveClass(/present/);

    // 检查底部悬浮统计：已签到 2，未签到 1
    await expect(page.locator('.sticky-bottom-bar .present-count')).toHaveText('已签到: 2 人');
    await expect(page.locator('.sticky-bottom-bar .absent-count')).toHaveText('未签到: 1 人');

    // 点击“确认提交”，拉起提交确认弹窗
    await page.click('button:has-text("确认提交")');
    await expect(page.locator('#confirm-dialog-title')).toHaveText('确认提交');
    
    // 点击“确定提交”进行最终提交
    await page.click('#confirm-dialog-confirm-btn');

    // 确认后应该跳回工作台
    await page.waitForURL(/\/class\/c_[a-f0-9]+/);
```

**Step 2: 提交 E2E 更改**
```bash
git add tests/e2e.spec.js
git commit -m "test: update check-in E2E tests for flat student grid and direct submission dialog"
```

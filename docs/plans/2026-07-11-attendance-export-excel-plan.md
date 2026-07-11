# Attendance Export Excel Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "Export Excel" button to the attendance query page that generates a download of the attendance records in a matrix format, while ensuring only the results area is scrollable.

**Architecture:** Implement client-side Excel generation using the existing `xlsx` library by reading the fully loaded query data, constructing an Array-of-Arrays (AOA) representation mapping students to columns and dates to rows (handling active days vs inactive days), and triggering the download. Update layout CSS to set the root container height to 100vh with overflow hidden, allowing only the table container to grow and scroll.

**Tech Stack:** React, Next.js, CSS (Vanilla), SheetJS (`xlsx`)

---

### Task 1: CSS Layout Styles for Fixed Height and Scroll Control

**Files:**
- Modify: `src/app/class/[id]/query/query.css`

**Step 1: Write target modifications for layout in query.css**
Modify the styling of `.query-dashboard-container`, `.content-area`, `.report-panel`, and `.table-container` to lock height and enable scrolling only on the table. Add styles for `.report-header` and `.btn-export`.

```css
/* Update query-dashboard-container to prevent global scrolling */
.query-dashboard-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  background-color: var(--bg-color);
  padding: 20px;
  overflow: hidden;
  box-sizing: border-box;
}

/* Update content-area to fill remaining vertical space without overflow */
.content-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  flex: 1;
  overflow: hidden;
}

/* Update report-panel to be a flex container filling remaining height */
.report-panel {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Update table-container to allow both horizontal and vertical scrolling */
.table-container {
  width: 100%;
  flex: 1;
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

/* Style report-header to contain title and export button */
.report-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
}

html.dark .report-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.report-header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-color);
}

/* Export Button styling with glassmorphism matching design system */
.btn-export {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  background: rgba(52, 199, 89, 0.15);
  color: var(--success-color);
  transition: all 0.2s ease;
}

.btn-export:hover {
  background: rgba(52, 199, 89, 0.25);
  transform: translateY(-1px);
}

.btn-export:active {
  transform: translateY(0) scale(0.98);
}

.export-icon {
  width: 16px;
  height: 16px;
}
```

**Step 2: Commit Task 1**
```bash
git add src/app/class/[id]/query/query.css
git commit -m "style: fix scrolling container layout and add export button styles"
```

---

### Task 2: Excel Export Logic and Button in Query Page

**Files:**
- Modify: `src/app/class/[id]/query/page.js`

**Step 1: Write target code changes in page.js**
Import `xlsx`, implement `handleExportExcel` to assemble raw data structure, render `.report-header` with "Export Excel" button inside the JSX report container.

At the top of the file:
```javascript
import * as XLSX from 'xlsx';
```

Inside the component, define the export handler:
```javascript
  const handleExportExcel = () => {
    if (!studentsData || studentsData.length === 0) return;

    // 1. 生成查询时间范围内的所有自然日数组 YYYY-MM-DD
    const dateList = [];
    let current = new Date(startDate);
    const end = new Date(endDate);
    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dateList.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }

    // 2. 找出有开启过签到的日期集合 (只要任意学生在当天有打卡记录就计入)
    const activeDates = new Set();
    studentsData.forEach(student => {
      if (student.records) {
        student.records.forEach(r => {
          activeDates.add(r.date);
        });
      }
    });

    // 3. 统计每个学生在开启过签到日期里的已签到天数和未签到天数
    // 签到天数直接取 student.totalCount
    // 未签到天数 = 开启过签到的日期中 status 为 false 或无记录的天数
    const getAbsentCount = (student) => {
      let count = 0;
      activeDates.forEach(dateStr => {
        const record = student.records ? student.records.find(r => r.date === dateStr) : null;
        if (!record || !record.status) {
          count++;
        }
      });
      return count;
    };

    // 4. 构建数据矩阵 AOA (Array of Arrays)
    const headerRow = ['', ...studentsData.map(s => s.name)];
    const presentRow = ['签到天数', ...studentsData.map(s => s.totalCount || 0)];
    const absentRow = ['未签到天数', ...studentsData.map(s => getAbsentCount(s))];

    const dailyRows = dateList.map(dateStr => {
      // 转换日期格式为 M月D日，例如 "2026-07-11" -> "7月11日"
      const parts = dateStr.split('-');
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      const formattedDate = `${month}月${day}日`;

      // 获取每一列学生的打卡表现
      const studentStatusList = studentsData.map(student => {
        // 如果这天根本没开启签到，直接返回空字符串保持空白
        if (!activeDates.has(dateStr)) {
          return '';
        }

        const record = student.records ? student.records.find(r => r.date === dateStr) : null;
        if (record) {
          const symbol = record.status ? '✓' : '✗';
          return record.remark ? `${symbol} ${record.remark}` : symbol;
        } else {
          // 若当天有开启签到，但该学生无记录，视作未打卡/未签到
          return '✗';
        }
      });

      return [formattedDate, ...studentStatusList];
    });

    const aoa = [headerRow, presentRow, absentRow, ...dailyRows];

    // 5. 使用 xlsx 生成并保存 Excel
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);

    // 设置列宽，以防文本过长截断 (第一列较宽显示日期，其余列等宽)
    const colWidths = [{ wch: 15 }, ...studentsData.map(() => ({ wch: 15 }))];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '考勤报表');

    const fileName = `${className}_考勤报表_${startDate}_至_${endDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };
```

Update the JSX part of `report-panel` to structure the `.report-header` and `.table-container` properly:
```javascript
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
              <>
                <div className="report-header">
                  <span className="report-header-title">考勤数据报表</span>
                  <button className="btn-export" onClick={handleExportExcel}>
                    <svg className="export-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>导出 Excel</span>
                  </button>
                </div>
                <div className="table-container">
                  <table className="report-table">
                     ... // table header and body remains the same
                  </table>
                </div>
              </>
            )}
          </div>
```

**Step 2: Commit Task 2**
```bash
git add src/app/class/[id]/query/page.js
git commit -m "feat: implement client-side excel export and add export button to UI"
```

---

### Task 3: Verify and Add End-to-End Tests

**Files:**
- Modify: `tests/e2e.spec.js`

**Step 1: Write E2E test modifications**
Assert the export button is visible, trigger a download, and verify download exists.

```javascript
    // 7. 进入查询页面
    await page.click('button:has-text("查询")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/query/);
    await expect(page.locator('.summary-info h2')).toHaveText(testClassName);

    // 点击“查询”以获取当前日期段的数据
    await page.click('button:has-text("查询")');

    // 验证表格内包含正确的学生统计数据
    const table = page.locator('.report-table');
    await expect(table.locator('tbody tr:nth-child(1) td.col-name')).toHaveText('学生甲');
    await expect(table.locator('tbody tr:nth-child(1) td.col-total')).toHaveText('1天');

    // 验证导出 Excel 按钮在查询完成后可见
    const exportBtn = page.locator('button:has-text("导出 Excel")');
    await expect(exportBtn).toBeVisible();

    // 监听并验证 Excel 下载
    const downloadPromise = page.waitForEvent('download');
    await exportBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('考勤报表');
    expect(download.suggestedFilename()).toContain('.xlsx');

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
```

**Step 2: Run verification**
Propose to build the Next.js production bundle and run the playwright tests.
Command:
```powershell
npm run build
npx playwright test
```
Verify tests pass.

**Step 3: Commit Task 3**
```bash
git add tests/e2e.spec.js
git commit -m "test: add end-to-end test cases for downloading attendance excel"
```

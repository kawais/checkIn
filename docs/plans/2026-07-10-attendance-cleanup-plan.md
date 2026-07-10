# 班级签到记录历史数据清理功能实现计划

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在班级页面（工作台）的查询按钮下方新增“清理”按钮，点击后弹窗选择截止日期，确认后删除此日期（含）之前的签到记录，并在后台执行 KV 月度数据的过滤清理。

**Architecture:** 
1. 前端在班级工作台 [page.js](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/page.js) 中直接挂载清理 Modal，默认日期填充 6 个月前的第一天，点击确认并经过 window.confirm 二次防误触确认后，向后端发起清理请求。
2. 后端新增 [clear.js](file:///D:/code/checkInReact/functions/api/attendance/clear.js)，获取当前班级在 KV 中的所有月份记录 key，遍历并读取其打卡数据，滤除目标截止日期（含）前的打卡明细，将剩余数据写回 KV。若当月数据为空则清理整月 Key。

**Tech Stack:** Next.js (Client Component), Vanilla CSS, Tencent EdgeOne KV, Playwright

---

### Task 1: 前端清理 UI 与交互测试

**Files:**
- Modify: [src/app/class/[id]/page.js](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/page.js)
- Modify: [tests/e2e.spec.js](file:///D:/code/checkInReact/tests/e2e.spec.js)

**Step 1: 在 E2E 测试中编写失败的清理测试用例**
在 `tests/e2e.spec.js` 的末尾追加测试逻辑：
```javascript
    // 8. 测试签到记录清理功能
    // 返回工作台
    await page.goto(workbenchUrl);
    
    // 验证清理按钮存在并点击
    const clearBtn = page.locator('button:has-text("清理")');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // 验证清理 Modal 展现
    const clearModal = page.locator('.modal-content');
    await expect(clearModal).toBeVisible();

    // 验证默认日期为 6 个月前的 1 日
    const dateInput = clearModal.locator('input[type="date"]');
    const defaultDate = await dateInput.inputValue();
    
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    const expectedDefaultDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    expect(defaultDate).toBe(expectedDefaultDate);

    // 修改日期为今天，以清理今天刚提交的记录进行测试
    const todayStr = new Date().toISOString().split('T')[0];
    await dateInput.fill(todayStr);

    // 拦截 window.confirm 并点击“确定”
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('您确定要永久删除');
      await dialog.accept();
    });

    // 点击确认删除
    await clearModal.locator('button:has-text("确认删除")').click();

    // 此时后端接口未实现，预期请求 /api/attendance/clear 应该会报错 404，且 Modal 无法正常关闭/报错
```

**Step 2: 运行测试以验证其失败**
运行：`npx playwright test tests/e2e.spec.js`
预期：测试失败，提示清理按钮不可见（或未找到）。

**Step 3: 最小化前端 UI 代码实现**
在 `src/app/class/[id]/page.js` 中：
1. 导入 `useState` 并定义 `isClearModalOpen`, `clearDate`, `isClearing` 状态。
2. 编写 `getDefaultClearDate` 函数：
   ```javascript
   const getDefaultClearDate = () => {
     const d = new Date();
     d.setMonth(d.getMonth() - 6);
     return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
   };
   ```
3. 在页面加载或 Modal 弹出时初始化 `clearDate`。
4. 在查询按钮下方挂载“清理”操作按钮，以及在 `isClearModalOpen` 为 `true` 时挂载 Modal 弹窗。
5. 编写 API 请求方法 `handleClearRecords`，使用 `api.post('/api/attendance/clear', { classId, date: clearDate })` 进行提交，完成后关闭弹窗并弹出成功提示。

**Step 4: 再次运行测试以验证前端部分测试通过 (但 API 请求仍会失败，返回 404)**
运行：`npx playwright test tests/e2e.spec.js`
预期：清理按钮已能点击，Modal 能正常弹出，默认时间匹配，且能触发 confirm 并向后端请求，最终测试在接口请求 `/api/attendance/clear` 处失败（HTTP 404）。

**Step 5: 暂存并 Commit**
运行：
```bash
git add src/app/class/[id]/page.js tests/e2e.spec.js
git commit -m "feat: add clear button and clear modal UI interaction"
```

---

### Task 2: 后端清理 API 接口实现

**Files:**
- Create: [functions/api/attendance/clear.js](file:///D:/code/checkInReact/functions/api/attendance/clear.js)

**Step 1: 编写后端清空记录的单元/接口逻辑**
新建 `functions/api/attendance/clear.js`，包含：
1. 请求方法限制为 `POST`。
2. 调用 `getAuthUser(env, request)` 鉴权。
3. 校验 `classId` 及 `date` 格式。
4. 校验班级归属权，获取 `class:${user.id}:${classId}`。
5. 利用 `kv.list(env, { prefix: `record:${classId}:` })` 找出所有月份 key。
6. 遍历月份 key，解析 `yearMonth`，若 `yearMonth <= date.substring(0, 7)` 则读取该月记录并进行清理：
   * 过滤删除所有 `dayDate <= date` 的记录。
   * 若该月记录删空，则 `kv.deleteKey`，否则 `kv.put`。
7. 返回 `{ success: true }` 成功响应。

**Step 2: 运行测试以验证清理接口通过**
运行：`npx playwright test tests/e2e.spec.js`
预期：清理流程成功运行，接口返回 200。因为记录已被清空，后续查询中测试能检测到打卡数据被清空，测试整体通过。

**Step 3: 暂存并 Commit**
运行：
```bash
git add functions/api/attendance/clear.js
git commit -m "feat: implement backend attendance records cleanup API"
```

---

### Task 3: 清理页面样式美化与边界样式校验

**Files:**
- Modify: [src/app/class/[id]/classhome.css](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/classhome.css)

**Step 1: 编写 Modal 及清理按钮样式**
在 `classhome.css` 中添加 Modal 样式：
```css
/* 清理按钮警告风格 */
.clear-icon {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.clear-btn:hover {
  border-color: rgba(239, 68, 68, 0.4);
  box-shadow: 0 8px 32px 0 rgba(239, 68, 68, 0.1);
}

/* 玻璃模态框遮罩 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

/* 模态框主体 */
.modal-content {
  width: 90%;
  max-width: 400px;
  padding: 24px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.15);
}

.warning-text {
  color: #ef4444;
  font-weight: 600;
  font-size: 1.15rem;
}

.warning-desc {
  font-size: 0.9rem;
  color: #666;
  margin: 12px 0 20px 0;
  line-height: 1.5;
}

/* 按钮及输入框样式 */
.date-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.1);
  background: rgba(255, 255, 255, 0.8);
  font-size: 1rem;
  margin-top: 8px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  margin-top: 24px;
  justify-content: flex-end;
}

.btn {
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.btn-secondary {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.btn-danger {
  background: #ef4444;
  color: white;
}

.btn-danger:hover {
  background: #dc2626;
}
```

**Step 2: 验证样式与功能全部通过**
运行：`npx playwright test tests/e2e.spec.js`
预期：E2E 测试完全通过，UI 样式显示完美。

**Step 3: 暂存并 Commit**
运行：
```bash
git add src/app/class/[id]/classhome.css
git commit -m "style: add glassmorphism modal styles for clear feature"
```

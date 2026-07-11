# 签到页面增加长按备注提示实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在签到页面的控制按钮下方增加“长按姓名可添加备注”的文字提示，并使用 Info 图标修饰，为用户提供直观的操作指引。

**Architecture:** 在 page.js 中新增一个包含 SVG 提示图标的 HTML 节点元素，并在 checkin.css 中新增相应的 CSS 样式进行修饰排版。

**Tech Stack:** React, Next.js, CSS, Playwright (E2E Test)

---

### Task 1: 样式修饰设计

**Files:**
- Modify: `src/app/class/[id]/checkin/checkin.css`

**Step 1: Write the failing test**
本步骤涉及 CSS 样式规则新增，不涉及业务逻辑，故跳过编写失败测试步骤，但在 Task 2 中统一通过端到端测试进行验证。

**Step 2: Run test to verify it fails**
跳过。

**Step 3: Write minimal implementation**
在 `src/app/class/[id]/checkin/checkin.css` 文件末尾（第 487 行起）追加以下样式：

```css
.checkin-hint-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 0 8px;
  margin-bottom: 12px;
  opacity: 0.8;
}

.checkin-hint-text .hint-icon {
  flex-shrink: 0;
  color: var(--primary-color);
}
```

**Step 4: Run test to verify it passes**
跳过。

**Step 5: Commit**

```bash
git add src/app/class/[id]/checkin/checkin.css
git commit -m "style: add styles for check-in remark hint text"
```

---

### Task 2: 增加提示节点与测试验证

**Files:**
- Modify: `src/app/class/[id]/checkin/page.js`
- Modify: `tests/e2e.spec.js`

**Step 1: Write the failing test**
修改 `tests/e2e.spec.js`，在页面进入签到页（约第 65 行）之后增加断言，检查提示文字是否在页面上展示。

```javascript
    // 6. 点击签到按钮
    await page.click('button:has-text("签到")');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/checkin/);

    // 验证“长按姓名可添加备注”提示文字是否可见
    await expect(page.locator('.checkin-hint-text')).toBeVisible();
    await expect(page.locator('.checkin-hint-text')).toHaveText('长按姓名可添加备注');
```

**Step 2: Run test to verify it fails**
启动本地开发服务器并运行 Playwright 验证测试。
运行：`npx playwright test tests/e2e.spec.js`
预期结果：测试失败，提示无法找到 `.checkin-hint-text` 元素。

**Step 3: Write minimal implementation**
在 `src/app/class/[id]/checkin/page.js` 的 `global-controls-section` 控制按钮下方插入提示节点。具体位置是在第 190~195 行之间：

```javascript
            {/* 全局控制按钮 */}
            <div className="global-controls-section">
              <button className="control-btn" onClick={handleSelectAll}>全选</button>
              <button className="control-btn" onClick={handleInvertSelection}>反选</button>
            </div>

            {/* 提示文字 */}
            <div className="checkin-hint-text">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="hint-icon">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
              <span>长按姓名可添加备注</span>
            </div>
```

**Step 4: Run test to verify it passes**
再次运行 Playwright 验证测试。
运行：`npx playwright test tests/e2e.spec.js`
预期结果：测试通过（PASS）。

**Step 5: Commit**

```bash
git add src/app/class/[id]/checkin/page.js tests/e2e.spec.js
git commit -m "feat: add remark hint text in check-in page"
```

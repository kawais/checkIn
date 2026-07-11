# 班级页面点击签到/查询时增加 Loading 实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在班级工作台页面，当用户点击“签到”或“查询”按钮后，立即在页面上显示全屏毛玻璃加载遮罩，提供清晰的过渡视觉反馈，避免用户重复点击。

**Architecture:** 在 `page.js` 中使用局部状态变量控制过渡加载弹窗显隐和提示语，并在跳转前设置该状态；在 `classhome.css` 中增加统一的全屏毛玻璃遮罩样式 `.full-page-loading`。

**Tech Stack:** React, Next.js, CSS, Playwright (E2E Test)

---

### Task 1: 增加样式规则

**Files:**
- Modify: `src/app/class/[id]/classhome.css`

**Step 1: Write the failing test**
由于这只是样式追加，不涉及组件功能，故跳过编写失败的测试。测试将在 Task 2 的端到端测试中统一覆盖。

**Step 2: Run test to verify it fails**
跳过。

**Step 3: Write minimal implementation**
在 `src/app/class/[id]/classhome.css` 文件末尾（第 484 行起）追加以下样式：

```css
/* 全屏 Loading 遮罩 */
.full-page-loading {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  color: #ffffff;
  gap: 16px;
}

.full-page-loading .spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.full-page-loading p {
  font-size: 15px;
  font-weight: 500;
  margin: 0;
  letter-spacing: 0.5px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

**Step 4: Run test to verify it passes**
跳过。

**Step 5: Commit**

```bash
git add src/app/class/[id]/classhome.css
git commit -m "style: add full-page loading styles for class home page"
```

---

### Task 2: 添加组件状态与过渡提示

**Files:**
- Modify: `src/app/class/[id]/page.js`
- Modify: `tests/e2e.spec.js`

**Step 1: Write the failing test**
修改 `tests/e2e.spec.js`，增加对点击“签到”及“查询”按钮后出现 transition loading 的断言。

1. 在第 62-64 行的点击签到逻辑中：
```javascript
    // 6. 点击签到按钮
    await page.click('button:has-text("签到")');
    await expect(page.locator('.full-page-loading')).toBeVisible();
    await expect(page.locator('.full-page-loading p')).toHaveText('正在载入签到页面...');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/checkin/);
```

2. 在第 141-143 行（原测试中，现可能顺延至 145 行左右）的进入查询页面逻辑中：
```javascript
    // 7. 进入查询页面
    await page.click('button:has-text("查询")');
    await expect(page.locator('.full-page-loading')).toBeVisible();
    await expect(page.locator('.full-page-loading p')).toHaveText('正在载入查询报表...');
    await page.waitForURL(/\/class\/c_[a-f0-9]+\/query/);
```

**Step 2: Run test to verify it fails**
运行：`npx playwright test tests/e2e.spec.js`
预期结果：测试失败，在试图验证 `.full-page-loading` 时超时或报错（因为尚未修改 React 组件以展示此遮罩）。

**Step 3: Write minimal implementation**
1. 修改 `src/app/class/[id]/page.js`，在文件顶部 `ClassHomePage` 组件中定义新的局部状态：
```javascript
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationText, setNavigationText] = useState('');
```

2. 替换原有跳转方法 `startCheckIn` 与 `queryRecords` 的实现：
```javascript
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
```

3. 在 JSX 返回结果的根容器中插入全屏加载遮罩条件渲染：
```jsx
      {/* 页面跳转 loading */}
      {isNavigating && (
        <div className="full-page-loading">
          <div className="spinner"></div>
          <p>{navigationText}</p>
        </div>
      )}
```

**Step 4: Run test to verify it passes**
再次运行 Playwright 测试：
运行：`npx playwright test tests/e2e.spec.js`
预期结果：测试通过（PASS）。

**Step 5: Commit**

```bash
git add src/app/class/[id]/page.js tests/e2e.spec.js
git commit -m "feat: add transition loading when clicking check-in or query on class page"
```

# 班级列表点击班级增加 Loading 遮罩实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在班级列表中点击班级时，显示一个 iOS 风格的毛玻璃全屏 Loading 遮罩层，阻断用户在路由加载期间的其他点击操作。

**Architecture:**
1. 在 `ClassesPage` (`src/app/classes/page.js`) 中增加 `isRedirecting` 状态，点击班级卡片时设置为 `true`，触发全屏遮罩条件渲染。
2. 在 `classes.css` (`src/app/classes/classes.css`) 中添加全屏毛玻璃遮罩样式 `.full-page-loading` 以及白色旋转加载动画。
3. 修改 E2E 测试 (`tests/e2e.spec.js`)，在点击卡片跳转期间，验证遮罩层已正确展现，并验证路由最终完成跳转。

**Tech Stack:** React (Next.js), CSS, Playwright (E2E Testing)

---

### Task 1: 编写失败的 E2E 测试

**Files:**
- Modify: `tests/e2e.spec.js:53-56`

**Step 1: 编写失败的测试**
在 `tests/e2e.spec.js` 的第 5 步 `点击进入班级工作台`，插入验证遮罩层的断言：
```diff
     // 5. 点击进入班级工作台
     await classCard.click();
+    // 验证 loading 遮罩立刻显现
+    await expect(page.locator('.full-page-loading')).toBeVisible();
+    await expect(page.locator('.full-page-loading p')).toHaveText('正在载入班级...');
     await page.waitForURL(/\/class\/c_[a-f0-9]+/);
```

**Step 2: 运行测试以验证其失败**
运行 E2E 测试，确认其在找不到 `.full-page-loading` 时报错失败。
运行：`npx playwright test tests/e2e.spec.js`
预期：FAIL（在寻找 `.full-page-loading` 时超时失败）

---

### Task 2: 编写 CSS 遮罩样式

**Files:**
- Modify: `src/app/classes/classes.css:484-497`

**Step 1: 编写遮罩样式**
在 `src/app/classes/classes.css` 的末尾追加 `.full-page-loading` 遮罩及其子元素样式。
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
```

**Step 2: 提交 CSS 更改**
直接提交 CSS 的改动，为 Task 3 做准备。
```bash
git add src/app/classes/classes.css
git commit -m "style: add styles for full-page loading overlay on class select"
```

---

### Task 3: 在 React 组件中实现 Loading 状态与条件渲染

**Files:**
- Modify: `src/app/classes/page.js`

**Step 1: 引入 `isRedirecting` 状态，触发条件渲染**
在 `src/app/classes/page.js` 中：
1. 声明状态：`const [isRedirecting, setIsRedirecting] = useState(false);`
2. 在 `goToClass` 中添加：`setIsRedirecting(true);`
3. 在 JSX 的最底部渲染：
```javascript
      {isRedirecting && (
        <div className="full-page-loading">
          <div className="spinner"></div>
          <p>正在载入班级...</p>
        </div>
      )}
```

具体修改详情：
- 在状态列表区域添加：
```javascript
  const [isRedirecting, setIsRedirecting] = useState(false);
```
- 修改 `goToClass` 函数：
```javascript
  const goToClass = (classId) => {
    setIsRedirecting(true);
    router.push(`/class/${classId}`);
  };
```
- 修改末尾的 JSX，在 `</div>` 关闭标签前：
```javascript
      {isRedirecting && (
        <div className="full-page-loading">
          <div className="spinner"></div>
          <p>正在载入班级...</p>
        </div>
      )}
    </div>
  );
}
```

**Step 2: 运行测试以验证其通过**
运行 E2E 测试，确认测试能够顺利通过。
运行：`npx playwright test tests/e2e.spec.js`
预期：PASS

**Step 3: 提交更改**
```bash
git add src/app/classes/page.js tests/e2e.spec.js
git commit -m "feat: show full-page loading overlay when clicking a class card"
```

# Playwright 端到端测试实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 引入 Playwright 测试，编写自动生成 Excel 夹具并运行端到端用户流的自动化测试用例，覆盖登录、创建班级、签到向导、二次提交、历史考勤查询等功能闭环，验证重构系统百分百正常。

**Architecture:** 使用 `@playwright/test` 在 headless 模式下运行 E2E 测试。在测试运行前利用 Node.js `xlsx` 库动态生成合格的学生名单 Excel 以用于上传功能测试。

**Tech Stack:** Playwright, Node.js, xlsx

---

### Task 1: 安装 Playwright 测试库

**Files:**
- Modify: `package.json` (自动安装)

**Step 1: 安装 Playwright npm 包**
Run: `npm install -D @playwright/test`
Expected: 成功写入 devDependencies。

**Step 2: 安装 Playwright 浏览器二进制包**
Run: `npx playwright install chromium`
Expected: 下载并配置好 Chromium 浏览器。

**Step 3: 提交依赖变更**
```bash
git add package.json package-lock.json
git commit -m "test: install playwright dependencies"
```

---

### Task 2: 编写辅助脚本生成 Excel 夹具

**Files:**
- Create: `tests/generate-test-excel.js`

**Step 1: 创建测试用 Excel 生成脚本**
在 `tests/generate-test-excel.js` 中写入：
```javascript
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

function generateExcel() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(fixturesDir)) {
    fs.mkdirSync(fixturesDir, { recursive: true });
  }

  const data = [
    { '序号': 1, '姓名': '学生甲' },
    { '序号': 2, '姓名': '学生乙' },
    { '序号': 3, '姓名': '学生丙' }
  ];

  const worksheet = xlsx.utils.json_to_sheet(data);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, '学生花名册');

  const outputPath = path.join(fixturesDir, 'students.xlsx');
  xlsx.writeFile(workbook, outputPath);
  console.log('Successfully generated test excel at:', outputPath);
}

generateExcel();
```

**Step 2: 运行生成脚本**
Run: `node tests/generate-test-excel.js`
Expected: 成功在 `tests/fixtures/students.xlsx` 处生成文件。

**Step 3: 提交**
```bash
git add tests/generate-test-excel.js
git commit -m "test: add script to generate test excel fixture"
```

---

### Task 3: 编写 E2E 测试脚本

**Files:**
- Create: `tests/e2e.spec.js`

**Step 1: 编写 Playwright 自动化测试逻辑**
在 `tests/e2e.spec.js` 中实现教师登录、进入班级列表、创建班级、为学生签到、并在查询页面得到统计的完整测试用例。
用例应该涵盖以下步骤：
- 登录 `admin` / `123456`
- 在班级列表拉起半屏抽屉，命名为“测试班级一”，上传 `tests/fixtures/students.xlsx`
- 点击进入“测试班级一”
- 验证签到状态提示，并点击签到
- 模拟按顺序对“学生甲”(出勤)、“学生乙”(出勤)、“学生丙”(缺勤) 进行签到
- 打卡完毕弹出的确认底栏中点击“确认提交”
- 进入该班级“查询”页，执行默认条件查询，验证“学生甲”在当月有 1 天出勤，“学生丙”为 0 天。

**Step 2: 提交**
```bash
git add tests/e2e.spec.js
git commit -m "test: add playwright e2e core user journey spec"
```

---

### Task 4: 配置 Playwright 并进行测试执行

**Files:**
- Create: `playwright.config.js`

**Step 1: 创建 Playwright 配置文件**
在 `playwright.config.js` 中配置 `webServer` 自动启动 Next.js 生产服务（`npm run start`，在测试前自动进行构建，或者测试前先 `npm run build`），并设定本地基准 URL。
```javascript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    viewport: { width: 375, height: 812 }, // 手机视口大小
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['iPhone 12'] },
    },
  ],
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
```

**Step 2: 运行测试**
在运行测试前，我们需要先把 Next.js 生产版本构建好：
Run: `npm run build`
然后运行 Playwright：
Run: `npx playwright test`
Expected: 所有测试项均 Pass (100% 成功率)。

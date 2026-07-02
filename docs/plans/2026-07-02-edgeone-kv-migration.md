# EdgeOne KV 存储迁移实施计划

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有本地 JSON 文件系统存储方案替换为标准的 Tencent EdgeOne KV 存储方案，并确保本地开发和自动化端到端测试 100% 兼容。

**Architecture:** 
1. 编写存储适配器模块 `src/utils/kv.js`，该模块在生产环境暴露原生的全局 `my_kv` 绑定；在本地环境，通过路径映射规则，使用 Node.js 的 `fs/promises` 模块将数据持久化到原有的 `data/` 目录结构中。
2. 采用**月度聚合**设计存储签到记录（Key 格式：`record:${classId}:${yearMonth}`，以减少边缘节点的 KV 查询与计费次数），并根据查询区间并发获取相关月份并在内存合并。
3. 替换路由 API 里的文件系统（`fs`）直接读写，改用 `kv.js` 的 API 读写。

**Tech Stack:** Node.js (Next.js App Router 16.2.9), EdgeOne KV API, Playwright (E2E)

---

### Task 1: 实现统一存储适配器 (`src/utils/kv.js`)

**Files:**
- Create: `src/utils/kv.js`
- Test: `tests/kv.test.js`

**Step 1: Write the failing test**
在 `tests/kv.test.js` 中编写适配器的测试。由于项目内没有 Jest/Vitest 依赖，使用 Node.js 的原生 `assert` 模块和 `test` 运行器。

```javascript
// tests/kv.test.js
const assert = require('assert');
const fs = require('fs/promises');
const path = require('path');

// 在测试中，我们可以通过 require 来测试适配器逻辑
async function runTests() {
  console.log('Running KV tests...');
  // 清理测试路径以保证幂等性
  try {
    await fs.rm(path.join(process.cwd(), 'data/classes/test_c1.json'), { force: true });
  } catch {}

  const kv = require('../src/utils/kv.js');
  
  // 1. 测试 put 和 get
  const classKey = 'class:test_teacher:test_c1';
  const testVal = JSON.stringify({ id: 'test_c1', name: 'Test Class', teacherId: 'test_teacher' });
  await kv.put(classKey, testVal);
  
  const readVal = await kv.get(classKey);
  assert.strictEqual(readVal, testVal, 'Get should return the exact string that was put');

  // 2. 测试 list
  const listResult = await kv.list({ prefix: 'class:test_teacher:' });
  assert.ok(listResult.keys.some(k => k.key === classKey), 'List should contain the created class key');

  // 3. 测试 delete
  await kv.delete(classKey);
  const deletedVal = await kv.get(classKey);
  assert.strictEqual(deletedVal, null, 'Deleted key should return null');

  console.log('All KV adapter tests passed!');
}

runTests().catch(err => {
  console.error('KV tests failed:', err);
  process.exit(1);
});
```

**Step 2: Run test to verify it fails**
Run: `node tests/kv.test.js`
Expected: FAIL, "Cannot find module '../src/utils/kv.js'" 或者 `AssertionError`。

**Step 3: Write minimal implementation**
创建 `src/utils/kv.js`：

```javascript
// src/utils/kv.js
import fs from 'fs/promises';
import path from 'path';

// 检查是否在 EdgeOne Pages 生产环境下，如果是则使用全局 my_kv 变量
const isProduction = typeof globalThis.my_kv !== 'undefined';

/**
 * 将 KV Key 映射为本地文件路径
 */
function getLocalPath(key) {
  const parts = key.split(':');
  if (parts[0] === 'teacher' && parts[1] === 'all') {
    return path.join(process.cwd(), 'data/teachers.json');
  }
  if (parts[0] === 'class') {
    // class:${teacherId}:${classId}
    const classId = parts[2] || parts[1]; // 兼容扁平格式
    return path.join(process.cwd(), 'data/classes', `${classId}.json`);
  }
  if (parts[0] === 'record') {
    // record:${classId}:${yearMonth}
    const classId = parts[1];
    const yearMonth = parts[2];
    return path.join(process.cwd(), 'data/records', classId, `${yearMonth}.json`);
  }
  // 备用兜底路径
  return path.join(process.cwd(), 'data/kv_fallback', `${key.replace(/:/g, '_')}.json`);
}

export async function get(key) {
  if (isProduction) {
    return await globalThis.my_kv.get(key);
  }
  try {
    const filePath = getLocalPath(key);
    return await fs.readFile(filePath, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function put(key, value) {
  if (isProduction) {
    return await globalThis.my_kv.put(key, value);
  }
  const filePath = getLocalPath(key);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, value, 'utf-8');
}

export async function deleteKey(key) {
  if (isProduction) {
    return await globalThis.my_kv.delete(key);
  }
  try {
    const filePath = getLocalPath(key);
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export async function list(options = {}) {
  if (isProduction) {
    return await globalThis.my_kv.list(options);
  }

  const { prefix = '' } = options;
  const parts = prefix.split(':');
  const type = parts[0];

  const keys = [];

  if (type === 'class') {
    // prefix is "class:${teacherId}:" or "class:"
    const teacherId = parts[1];
    const classesDir = path.join(process.cwd(), 'data/classes');
    try {
      const files = await fs.readdir(classesDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(classesDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          if (!teacherId || data.teacherId === teacherId) {
            keys.push({ key: `class:${data.teacherId}:${data.id}` });
          }
        } catch {}
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  } else if (type === 'record') {
    // prefix is "record:${classId}:"
    const classId = parts[1];
    const recordsDir = path.join(process.cwd(), 'data/records', classId);
    try {
      const files = await fs.readdir(recordsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const yearMonth = path.basename(file, '.json');
        keys.push({ key: `record:${classId}:${yearMonth}` });
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  return { keys, complete: true };
}

// 供 CommonJS 测试运行器调用的 fallback 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    get: async (k) => (await import('./kv.js')).get(k),
    put: async (k, v) => (await import('./kv.js')).put(k, v),
    delete: async (k) => (await import('./kv.js')).deleteKey(k),
    list: async (o) => (await import('./kv.js')).list(o),
  };
}
```

**Step 4: Run test to verify it passes**
Run: `node tests/kv.test.js`
Expected: PASS, 打印 "All KV adapter tests passed!"

**Step 5: Commit**
```bash
git add src/utils/kv.js tests/kv.test.js
git commit -m "feat: implement unified EdgeOne KV storage adapter"
```

---

### Task 2: 重构教师登录接口 (`src/app/api/auth/login/route.js`)

**Files:**
- Modify: `src/app/api/auth/login/route.js`

**Step 1: Write the failing test**
运行现有的端到端测试。
Run: `npx playwright test`
Expected: PASS（目前使用的是本地 data 文件，我们需要证明在这个路由改动后功能依然正常）。

**Step 2: Run test to verify it fails**
（略，因为该步骤改动无 failing 状态，只需要最终 E2E 绿即可）

**Step 3: Write minimal implementation**
重构 `src/app/api/auth/login/route.js` 中的读取逻辑，引入 `src/utils/kv.js`：

```javascript
// 修改前：
// const teachersPath = path.join(process.cwd(), 'data/teachers.json');
// const data = await fs.readFile(teachersPath, 'utf-8');
// const teachers = JSON.parse(data);

// 修改后：
import * as kv from '@/utils/kv';

const data = await kv.get('teacher:all');
if (!data) {
  log('No teacher data found in KV');
  return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
}
const teachers = JSON.parse(data);
```

**Step 4: Run test to verify it passes**
运行登录 E2E 测试。
Run: `npx playwright test -g "教师登录"`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/auth/login/route.js
git commit -m "refactor: migrate teacher login database calls to EdgeOne KV"
```

---

### Task 3: 重构班级创建与查询服务 (`src/app/api/classes/route.js` 和 `src/app/api/classes/[id]/route.js`)

**Files:**
- Modify: `src/app/api/classes/route.js`
- Modify: `src/app/api/classes/[id]/route.js`

**Step 1: Write the failing test**
（略过）

**Step 2: Run test to verify it fails**
（略过）

**Step 3: Write minimal implementation**

1. 修改 `src/app/api/classes/route.js` 中的 `GET` 和 `POST`：

```javascript
import * as kv from '@/utils/kv';

// GET: 获取当前老师的所有班级
export async function GET(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const listResult = await kv.list({ prefix: `class:${user.id}:` });
    const keys = Array.isArray(listResult?.keys) ? listResult.keys : [];

    const readPromises = keys.map(async (item) => {
      const classContent = await kv.get(item.key);
      if (!classContent) return null;
      const classData = JSON.parse(classContent);
      return {
        id: classData.id,
        name: classData.name,
        studentCount: Array.isArray(classData.students) ? classData.students.length : 0
      };
    });

    const classes = (await Promise.all(readPromises)).filter(Boolean);
    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST: 上传 Excel 创建班级
// 重构文件写入部分：
// 替换：
// await fs.mkdir(CLASSES_DIR, { recursive: true });
// const classFilePath = path.join(CLASSES_DIR, `${classId}.json`);
// await fs.writeFile(classFilePath, JSON.stringify(newClass, null, 2), 'utf-8');
//
// 替换为：
await kv.put(`class:${user.id}:${classId}`, JSON.stringify(newClass));
```

2. 修改 `src/app/api/classes/[id]/route.js` 中的 `GET`：

```javascript
import * as kv from '@/utils/kv';

export async function GET(req, { params }) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !classIdRegex.test(id)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    const classKey = `class:${user.id}:${id}`;
    const fileContent = await kv.get(classKey);
    if (!fileContent) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    const classData = JSON.parse(fileContent);
    return NextResponse.json(classData);
  } catch (err) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }
}
```

**Step 4: Run test to verify it passes**
运行创建班级 E2E 测试。
Run: `npx playwright test -g "创建班级"`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/classes/route.js src/app/api/classes/[id]/route.js
git commit -m "refactor: migrate class list, create and ID lookup to EdgeOne KV"
```

---

### Task 4: 重构考勤提交服务 (`src/app/api/attendance/submit/route.js`)

**Files:**
- Modify: `src/app/api/attendance/submit/route.js`

**Step 1: Write the failing test**
（略过）

**Step 2: Run test to verify it fails**
（略过）

**Step 3: Write minimal implementation**
修改 `src/app/api/attendance/submit/route.js` 中的 `POST`：

```javascript
import * as kv from '@/utils/kv';

export async function POST(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { classId, date, attendance } = body;

    if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    if (!Array.isArray(attendance)) {
      return NextResponse.json({ error: '请求体格式错误，必须包含 attendance 数组' }, { status: 400 });
    }

    // 校验班级是否存在（利用 kv.get）
    const classKey = `class:${user.id}:${classId}`;
    const classData = await kv.get(classKey);
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    // 写入月度聚合记录
    const yearMonth = date.substring(0, 7); // 'YYYY-MM'
    const recordKey = `record:${classId}:${yearMonth}`;
    
    // 获取当月所有记录
    const existingRecordsStr = await kv.get(recordKey);
    const monthlyRecords = existingRecordsStr ? JSON.parse(existingRecordsStr) : {};
    
    // 合并并写入
    monthlyRecords[date] = { date, attendance };
    await kv.put(recordKey, JSON.stringify(monthlyRecords));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**
运行打卡 E2E 测试。
Run: `npx playwright test -g "学生签到"`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/attendance/submit/route.js
git commit -m "refactor: migrate attendance submission to monthly aggregated EdgeOne KV"
```

---

### Task 5: 重构考勤状态校验与考勤查询服务 (`check-status` 与 `query` API)

**Files:**
- Modify: `src/app/api/attendance/check-status/route.js`
- Modify: `src/app/api/attendance/query/route.js`

**Step 1: Write the failing test**
（略过）

**Step 2: Run test to verify it fails**
（略过）

**Step 3: Write minimal implementation**

1. 修改 `src/app/api/attendance/check-status/route.js` 中的 `GET`：

```javascript
import * as kv from '@/utils/kv';

export async function GET(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const date = searchParams.get('date');

  if (!classId || !classIdRegex.test(classId) || !date || !dateRegex.test(date)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    const yearMonth = date.substring(0, 7);
    const recordKey = `record:${classId}:${yearMonth}`;
    const recordStr = await kv.get(recordKey);
    
    if (recordStr) {
      const monthlyRecords = JSON.parse(recordStr);
      if (monthlyRecords[date]) {
        return NextResponse.json({ submitted: true });
      }
    }
    return NextResponse.json({ submitted: false });
  } catch (err) {
    return NextResponse.json({ submitted: false });
  }
}
```

2. 修改 `src/app/api/attendance/query/route.js` 中的 `GET`：

```javascript
import * as kv from '@/utils/kv';

// 辅助函数：根据起止日期计算跨越的月份 ['YYYY-MM', ...]
function getMonthsInRange(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const result = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const targetEnd = new Date(end.getFullYear(), end.getMonth(), 1);

  while (current <= targetEnd) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    result.push(`${year}-${month}`);
    current.setMonth(current.getMonth() + 1);
  }
  return result;
}

export async function GET(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!classId || !classIdRegex.test(classId)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }
  if (startDate && !dateRegex.test(startDate)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }
  if (endDate && !dateRegex.test(endDate)) {
    return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
  }

  try {
    // 1. 获取班级数据以确定学生列表
    const classKey = `class:${user.id}:${classId}`;
    const classContent = await kv.get(classKey);
    if (!classContent) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    const classData = JSON.parse(classContent);

    if (!classData || !Array.isArray(classData.students)) {
      return NextResponse.json({ error: '班级数据格式错误' }, { status: 400 });
    }

    const studentMap = {};
    const studentsList = classData.students;
    for (const student of studentsList) {
      if (student && student.id) {
        studentMap[student.id] = {
          id: student.id,
          name: student.name || '',
          monthlyCounts: {},
          totalCount: 0,
          records: []
        };
      }
    }

    // 2. 获取涉及的月份键名
    let targetMonths = [];
    if (startDate && endDate) {
      targetMonths = getMonthsInRange(startDate, endDate);
    } else {
      // 若没有提供完整的起止时间，则利用 list 找出该班级的所有月份 key
      const listResult = await kv.list({ prefix: `record:${classId}:` });
      const keys = Array.isArray(listResult?.keys) ? listResult.keys : [];
      targetMonths = keys.map(k => k.key.split(':')[2]);
    }

    // 3. 并发获取并解析各月的考勤记录
    const readPromises = targetMonths.map(async (yearMonth) => {
      const recordKey = `record:${classId}:${yearMonth}`;
      try {
        const content = await kv.get(recordKey);
        return content ? JSON.parse(content) : null;
      } catch (err) {
        console.error(`Error reading monthly record ${recordKey}:`, err);
        return null;
      }
    });

    const monthlyRecordsResults = (await Promise.all(readPromises)).filter(Boolean);

    // 4. 在内存中合并并按起止日期范围过滤
    for (const monthlyData of monthlyRecordsResults) {
      for (const [dateStr, dayRecord] of Object.entries(monthlyData)) {
        // 进行日期范围的过滤
        if (startDate && dateStr < startDate) continue;
        if (endDate && dateStr > endDate) continue;

        if (dayRecord && Array.isArray(dayRecord.attendance)) {
          for (const item of dayRecord.attendance) {
            if (item && item.studentId) {
              const sId = item.studentId;
              if (studentMap[sId]) {
                const status = !!item.status;
                studentMap[sId].records.push({ date: dateStr, status });

                if (status) {
                  studentMap[sId].totalCount += 1;
                  const month = dateStr.substring(0, 7); // 'YYYY-MM'
                  studentMap[sId].monthlyCounts[month] = (studentMap[sId].monthlyCounts[month] || 0) + 1;
                }
              }
            }
          }
        }
      }
    }

    // 5. 按照学生列表顺序返回结果
    const resultStudents = studentsList
      .filter(s => s && s.id)
      .map(s => studentMap[s.id]);

    return NextResponse.json({ students: resultStudents });
  } catch (error) {
    console.error('Error querying attendance:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
```

**Step 4: Run test to verify it passes**
运行历史考勤查询 E2E 测试。
Run: `npx playwright test -g "历史考勤查询"`
Expected: PASS

**Step 5: Commit**
```bash
git add src/app/api/attendance/check-status/route.js src/app/api/attendance/query/route.js
git commit -m "refactor: migrate attendance status check and query services to EdgeOne KV"
```

---

### Task 6: 完整端到端测试与收尾验证

**Files:**
- Test: `tests/e2e.spec.js`

**Step 1: Write the failing test**
（无）

**Step 2: Run test to verify it fails**
（无）

**Step 3: Run the full verification suite**
1. 启动本地服务器环境：`npm run dev`
2. 运行完整的 Playwright 端到端测试套件：`npx playwright test`
3. 确保所有测试全绿通过。

**Step 4: Commit and Clean up**
无额外代码变更。
```bash
git status
```
验证工作区是否干净。

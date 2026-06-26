# 托管签到系统 Next.js 重写实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 使用 Next.js & React 彻底重构原托管签到系统，功能与数据结构保持完全一致，保证所有考勤业务正常流转。

**Architecture:** 采用单体全栈 Next.js App Router 架构。后端基于 Next.js Route Handlers 读取 `data/` 下的 JSON 文件，前端使用 React 重写 Vue 组件并保留原有精美的苹果毛玻璃界面和手势。

**Tech Stack:** Next.js, React, JSON file-system storage, jwt (jsonwebtoken), bcryptjs, xlsx (sheetjs)

---

### Task 1: 初始化配置与数据搬迁

**Files:**
- Create: `data/` (通过复制)
- Modify: `package.json` (自动安装依赖)

**Step 1: 复制原项目数据目录**
Run: `Copy-Item -Path d:\code\checkIn\data -Destination ./ -Recurse -Force`
Expected: 复制 `teachers.json` 及 `classes/`, `records/` 子目录。

**Step 2: 安装全栈重构必须的依赖**
Run: `npm install bcryptjs jsonwebtoken xlsx`
Expected: 依赖成功写入 `package.json` 并安装。

**Step 3: 提交配置变更**
Run: `git add .` (这里不需要立即 commit，但为了契合 TDD，可执行提交)
```bash
git commit -m "chore: copy data and install packages"
```

---

### Task 2: 后端 JWT 与加密验证模块

**Files:**
- Create: `src/utils/jwt.js`

**Step 1: 编写加密和 Token 校验代码**
在新文件 `src/utils/jwt.js` 中写入：
```javascript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'apple_style_secret_key';

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

export function getAuthUser(req) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return null;
  return verifyToken(token);
}
```

**Step 2: 验证编译成功**
无需额外运行测试，确保编译通过。

**Step 3: 提交**
```bash
git add src/utils/jwt.js
git commit -m "feat: add jwt utility helper"
```

---

### Task 3: 教师登录 API Handler

**Files:**
- Create: `src/app/api/auth/login/route.js`

**Step 1: 编写 Route Handler**
在 `src/app/api/auth/login/route.js` 中实现：
```javascript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import bcrypt from 'bcryptjs';
import { signToken } from '@/utils/jwt';

export async function POST(req) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json({ error: '用户名和密码不能为空' }, { status: 400 });
    }

    const teachersPath = path.join(process.cwd(), 'data/teachers.json');
    const data = await fs.readFile(teachersPath, 'utf-8');
    const teachers = JSON.parse(data);
    const teacher = teachers.find(t => t.username === username);

    if (!teacher) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, teacher.password);
    if (!isMatch) {
      return NextResponse.json({ error: '用户名或密码错误' }, { status: 401 });
    }

    const token = signToken({ id: teacher.id, name: teacher.name });

    return NextResponse.json({
      token,
      teacher: {
        id: teacher.id,
        name: teacher.name
      }
    });
  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
```

**Step 2: 提交**
```bash
git add src/app/api/auth/login/route.js
git commit -m "feat: implement teacher login api route"
```

---

### Task 4: 班级列表与创建班级 API Handler

**Files:**
- Create: `src/app/api/classes/route.js`

**Step 1: 编写 Route Handler**
在 `src/app/api/classes/route.js` 中支持 `GET` 和 `POST`。在 `POST` 里解析 Multipart FormData 形式上传的 Excel 文件，并用 `xlsx` 解析生成学生清单。
```javascript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import * as xlsx from 'xlsx';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');

// GET: 获取当前老师的所有班级
export async function GET(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    await fs.mkdir(CLASSES_DIR, { recursive: true });
    const files = await fs.readdir(CLASSES_DIR);
    const classes = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const filePath = path.join(CLASSES_DIR, file);
      try {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const classData = JSON.parse(fileContent);

        if (classData.teacherId === user.id) {
          classes.push({
            id: classData.id,
            name: classData.name,
            studentCount: Array.isArray(classData.students) ? classData.students.length : 0
          });
        }
      } catch (err) {
        console.error(`Error reading class file ${file}:`, err);
      }
    }
    return NextResponse.json(classes);
  } catch (error) {
    console.error('Error fetching classes:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}

// POST: 上传 Excel 创建班级
export async function POST(req) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ error: '未授权，请登录' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const className = formData.get('name');
    const file = formData.get('file');

    if (!className || className.trim() === '') {
      return NextResponse.json({ error: '班级名称不能为空' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: '请上传 Excel 文件' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let workbook;
    try {
      workbook = xlsx.read(buffer, { type: 'buffer' });
    } catch (e) {
      return NextResponse.json({ error: 'Excel 文件解析失败' }, { status: 400 });
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return NextResponse.json({ error: 'Excel 文件没有工作表' }, { status: 400 });
    }

    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1 });

    if (!sheetData || sheetData.length === 0 || !sheetData[0]) {
      return NextResponse.json({ error: 'Excel 文件内容为空，未能解析到表头' }, { status: 400 });
    }

    const headers = sheetData[0];
    const seqNumIndex = headers.indexOf('序号');
    const nameIndex = headers.indexOf('姓名');

    if (seqNumIndex === -1 || nameIndex === -1) {
      return NextResponse.json({ error: 'Excel 文件格式错误，必须包含"序号"和"姓名"列' }, { status: 400 });
    }

    const students = [];
    for (let i = 1; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (!row || row.length === 0) continue;

      const seqNum = row[seqNumIndex];
      const name = row[nameIndex];

      if (name === undefined || name === null || String(name).trim() === '') {
        continue;
      }

      const studentId = `s_${crypto.randomUUID().replace(/-/g, '')}`;
      let parsedSeqNum = Number(seqNum);
      if (isNaN(parsedSeqNum) || seqNum === undefined || seqNum === null || String(seqNum).trim() === '') {
        parsedSeqNum = i;
      }

      students.push({
        id: studentId,
        seqNum: parsedSeqNum,
        name: String(name).trim()
      });
    }

    const classId = `c_${crypto.randomUUID().replace(/-/g, '')}`;
    const newClass = {
      id: classId,
      teacherId: user.id,
      name: className.trim(),
      students
    };

    await fs.mkdir(CLASSES_DIR, { recursive: true });
    const classFilePath = path.join(CLASSES_DIR, `${classId}.json`);
    await fs.writeFile(classFilePath, JSON.stringify(newClass, null, 2), 'utf-8');

    return NextResponse.json({ success: true, class: newClass });
  } catch (error) {
    console.error('Error creating class:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
```

**Step 2: 提交**
```bash
git add src/app/api/classes/route.js
git commit -m "feat: implement classes list and import api routes"
```

---

### Task 5: 班级详情 API Handler

**Files:**
- Create: `src/app/api/classes/[id]/route.js`

**Step 1: 编写 Route Handler**
在 `src/app/api/classes/[id]/route.js` 中实现：
```javascript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;

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
    const classFilePath = path.join(CLASSES_DIR, `${id}.json`);
    const fileContent = await fs.readFile(classFilePath, 'utf-8');
    const classData = JSON.parse(fileContent);

    if (classData.teacherId !== user.id) {
      return NextResponse.json({ error: '无权访问该班级' }, { status: 403 });
    }

    return NextResponse.json(classData);
  } catch (err) {
    return NextResponse.json({ error: '班级不存在' }, { status: 404 });
  }
}
```

**Step 2: 提交**
```bash
git add src/app/api/classes/[id]/route.js
git commit -m "feat: implement class detail api route"
```

---

### Task 6: 考勤状态与考勤提交 API Handlers

**Files:**
- Create: `src/app/api/attendance/check-status/route.js`
- Create: `src/app/api/attendance/submit/route.js`

**Step 1: 编写 check-status Route Handler**
在 `src/app/api/attendance/check-status/route.js` 中写入：
```javascript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const RECORDS_DIR = path.join(process.cwd(), 'data/records');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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
    const recordFilePath = path.join(RECORDS_DIR, classId, `${date}.json`);
    await fs.access(recordFilePath);
    return NextResponse.json({ submitted: true });
  } catch (err) {
    return NextResponse.json({ submitted: false });
  }
}
```

**Step 2: 编写 submit Route Handler**
在 `src/app/api/attendance/submit/route.js` 中写入：
```javascript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');
const RECORDS_DIR = path.join(process.cwd(), 'data/records');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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

    const classFilePath = path.join(CLASSES_DIR, `${classId}.json`);
    try {
      await fs.access(classFilePath);
    } catch (err) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    const classRecordsDir = path.join(RECORDS_DIR, classId);
    await fs.mkdir(classRecordsDir, { recursive: true });

    const recordFilePath = path.join(classRecordsDir, `${date}.json`);
    const recordData = { date, attendance };

    await fs.writeFile(recordFilePath, JSON.stringify(recordData, null, 2), 'utf-8');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
```

**Step 3: 提交**
```bash
git add src/app/api/attendance/check-status/route.js src/app/api/attendance/submit/route.js
git commit -m "feat: implement check-status and submit api routes"
```

---

### Task 7: 考勤明细查询 API Handler

**Files:**
- Create: `src/app/api/attendance/query/route.js`

**Step 1: 编写 query Route Handler**
在 `src/app/api/attendance/query/route.js` 中写入：
```javascript
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { getAuthUser } from '@/utils/jwt';

const CLASSES_DIR = path.join(process.cwd(), 'data/classes');
const RECORDS_DIR = path.join(process.cwd(), 'data/records');
const classIdRegex = /^[a-zA-Z0-9_-]+$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

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
    const classFilePath = path.join(CLASSES_DIR, `${classId}.json`);
    let classData;
    try {
      const fileContent = await fs.readFile(classFilePath, 'utf-8');
      classData = JSON.parse(fileContent);
    } catch (err) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

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

    const classRecordsDir = path.join(RECORDS_DIR, classId);
    let files = [];
    try {
      files = await fs.readdir(classRecordsDir);
    } catch (err) {
      files = [];
    }

    const targetFiles = files
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const dateStr = path.basename(file, '.json');
        return { file, dateStr };
      })
      .filter(({ dateStr }) => {
        if (startDate && dateStr < startDate) return false;
        if (endDate && dateStr > endDate) return false;
        return true;
      });

    const readPromises = targetFiles.map(async ({ file, dateStr }) => {
      const recordFilePath = path.join(classRecordsDir, file);
      try {
        const fileContent = await fs.readFile(recordFilePath, 'utf-8');
        const dayRecord = JSON.parse(fileContent);
        return { dateStr, dayRecord };
      } catch (err) {
        console.error(`Error reading daily record file ${file}:`, err);
        return null;
      }
    });

    const dayRecordsResults = await Promise.all(readPromises);

    for (const result of dayRecordsResults) {
      if (!result || !result.dayRecord) continue;
      const { dateStr, dayRecord } = result;

      if (Array.isArray(dayRecord.attendance)) {
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

**Step 2: 提交**
```bash
git add src/app/api/attendance/query/route.js
git commit -m "feat: implement query attendance api route"
```

---

### Task 8: 前端 API 与路由守卫机制

**Files:**
- Create: `src/utils/api.js`
- Create: `src/components/AuthGuard.js`

**Step 1: 编写前端 HTTP 拦截器**
在 `src/utils/api.js` 中封装 fetch 请求：
```javascript
const api = {
  get: async (url, options = {}) => {
    return api.request(url, { ...options, method: 'GET' });
  },
  post: async (url, body, options = {}) => {
    return api.request(url, {
      ...options,
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      headers: body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers }
    });
  },
  request: async (url, options = {}) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const headers = {
      ...options.headers,
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (response.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('teacherName');
        window.location.href = '/login';
      }
      throw new Error('未授权，请登录');
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const err = new Error(data.error || '请求失败');
      err.response = { status: response.status, data };
      throw err;
    }

    const data = await response.json();
    return { data };
  }
};

export default api;
```

**Step 2: 编写 AuthGuard 组件**
在 `src/components/AuthGuard.js` 中写入路由保护逻辑：
```javascript
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthGuard({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token && pathname !== '/login') {
      setAuthorized(false);
      router.push('/login');
    } else if (token && pathname === '/login') {
      setAuthorized(false);
      router.push('/classes');
    } else {
      setAuthorized(true);
    }
  }, [pathname, router]);

  if (!authorized) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#F2F2F7', color: '#8E8E93' }}>
        <p>正在验证权限...</p>
      </div>
    );
  }

  return children;
}
```

**Step 3: 提交**
```bash
git add src/utils/api.js src/components/AuthGuard.js
git commit -m "feat: add api client and auth guard logic"
```

---

### Task 9: 全局样式与 App 整体容器重写

**Files:**
- Create: `src/styles/globals.css` (清空并重写)
- Modify: `src/app/layout.js`
- Modify: `src/app/page.js`

**Step 1: 全局 CSS (包含明亮与暗黑模式定义)**
将原 `style.css` 内容移至 `src/styles/globals.css` 中并加入全局重构：
```css
:root {
  --primary-color: #007AFF;
  --success-color: #34C759;
  --danger-color: #FF3B30;
  --warning-color: #FF9500;
  
  --bg-color: #F2F2F7;
  --text-color: #000000;
  --text-secondary: #8E8E93;
  
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: 1px solid rgba(255, 255, 255, 0.3);
  --glass-blur: blur(20px);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.08);

  --font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

html.dark {
  --bg-color: #000000;
  --text-color: #FFFFFF;
  --text-secondary: #8E8E93;
  
  --glass-bg: rgba(28, 28, 30, 0.7);
  --glass-border: 1px solid rgba(255, 255, 255, 0.1);
  --glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-family);
  background-color: var(--bg-color);
  color: var(--text-color);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
}

.app-container {
  width: 100%;
  max-width: 480px;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.05);
  position: relative;
}

.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: 12px;
}
```

**Step 2: 调整 `src/app/layout.js` 适配 App 手机视口**
```javascript
import '../styles/globals.css';
import AuthGuard from '@/components/AuthGuard';

export const metadata = {
  title: '托管签到系统',
  description: '教师端考勤托管签到系统',
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh">
      <body>
        <div className="app-container">
          <AuthGuard>{children}</AuthGuard>
        </div>
      </body>
    </html>
  );
}
```

**Step 3: 调整 `src/app/page.js` 默认重定向**
```javascript
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/classes');
}
```

**Step 4: 提交**
```bash
git add src/styles/globals.css src/app/layout.js src/app/page.js
git commit -m "feat: set global layouts, styles, and page redirects"
```

---

### Task 10: 登录前端页面重写

**Files:**
- Create: `src/app/login/page.js`

**Step 1: 实现登录页面**
创建 `src/app/login/page.js`，实现与 Vue 相同的渐变背景与玻璃面板表单，并且在此组件中强制关闭 Auth 检查以防死循环（AuthGuard 中已包含排除逻辑）。
由于 `AuthGuard` 会包裹子组件，但我们要在页面加载时把主题样式应用正确，支持暗黑模式检测。
在页面中使用 `"use client"`。
实现代码太长，后续直接按原 Vue 样式的布局与逻辑写入。

**Step 2: 提交**
```bash
git add src/app/login/page.js
git commit -m "feat: rewrite login page in react"
```

---

### Task 11: 班级列表页与创建班级前端页面重写

**Files:**
- Create: `src/app/classes/page.js`

**Step 1: 实现班级列表及上传导入功能**
创建 `src/app/classes/page.js`。利用 React 状态控制明暗主题（修改 `document.documentElement.classList`）、底部抽屉展现状态，以及上传 Excel 的事件监听。

**Step 2: 提交**
```bash
git add src/app/classes/page.js
git commit -m "feat: rewrite classes list page in react"
```

---

### Task 12: 班级工作台前端页面重写

**Files:**
- Create: `src/app/class/[id]/page.js`

**Step 1: 实现班级主页与操作入口**
创建 `src/app/class/[id]/page.js`。根据路由 ID 请求获取班级详情和今日打卡状态。

**Step 2: 提交**
```bash
git add src/app/class/[id]/page.js
git commit -m "feat: rewrite class home workbench in react"
```

---

### Task 13: 签到卡片向导及确认抽屉重写

**Files:**
- Create: `src/app/class/[id]/checkin/page.js`

**Step 1: 实现签到页逻辑**
创建 `src/app/class/[id]/checkin/page.js`。实现 React 状态驱动的进度百分比计算、滑动切换动作、上一步回退、提交数据组合。
并在大名单全部选择完成后拉起半屏确认抽屉进行总计统计和临时状态微调。

**Step 2: 提交**
```bash
git add src/app/class/[id]/checkin/page.js
git commit -m "feat: rewrite checkin guidance page in react"
```

---

### Task 14: 考勤查询与下滑手势明细抽屉重写

**Files:**
- Create: `src/app/class/[id]/query/page.js`

**Step 1: 实现出勤查询与聚合表格**
创建 `src/app/class/[id]/query/page.js`。动态按查询的跨度月份生成多列（按 "YYYY-MM" 合并计算天数），并支持查询和清除。
实现详情 iOS 底栏，支持鼠标和手势触屏垂直下滑超过 100px 自动关闭交互。

**Step 2: 提交**
```bash
git add src/app/class/[id]/query/page.js
git commit -m "feat: rewrite attendance query and gestured bottom sheet in react"
```

---

### Task 15: 移除多余的脚手架代码与最终构建测试

**Files:**
- Modify: `package.json`
- Delete: 不需要的文件（如 `src/app/page.module.css`, `public/next.svg` 等，或者保留）

**Step 1: 移除无用 CSS 文件**
Run: `Remove-Item src/app/page.module.css -ErrorAction Ignore`

**Step 2: 启动 Next.js 生产编译**
Run: `npm run build`
Expected: 编译完全无错，并且静态路由正常编译。

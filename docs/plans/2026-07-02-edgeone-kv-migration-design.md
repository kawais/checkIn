# Tencent EdgeOne KV 存储迁移设计文档

## 1. 背景与目标
为了将项目的存储服务迁移至 Tencent EdgeOne 边缘存储（KV 存储），我们需要在不破坏本地开发测试环境和 Playwright 端到端测试的前提下，重构目前的存储逻辑。
本项目原本使用 Node.js 的本地文件系统读写 `data/` 目录下的 JSON 文件，我们将此数据存储方案替换为基于 EdgeOne KV 接口的存储服务。

## 2. 详细设计

### 2.1 统一存储适配器 (`src/utils/kv.js`)
我们将提供一个名为 `src/utils/kv.js` 的存储模块，对外暴露标准的 KV API（`get`, `put`, `list`, `delete`）。

#### 环境分流逻辑
* **生产环境**：若全局环境存在 `my_kv` 变量，则使用 EdgeOne 的原生绑定。
* **本地开发与测试**：若全局没有 `my_kv`，则由 `src/utils/kv.js` 内部利用文件系统（`fs/promises`）实现一套 KV API，在本地进行数据落盘。

#### 本地 KV Key 映射规则
为了能够完美兼容现有的本地数据、自动化端到端测试，本地适配层将 KV 的 `key` 映射至原先的文件目录：
* `teacher:all` $\rightarrow$ `data/teachers.json`
* `class:${teacherId}:${classId}` $\rightarrow$ `data/classes/${classId}.json`
* `record:${classId}:${yearMonth}` $\rightarrow$ `data/records/${classId}/${yearMonth}.json`

#### 本地 `list` 模拟机制
* `prefix` 为 `class:${teacherId}:`：
  遍历 `data/classes/` 目录下的所有 JSON 文件，读取文件解析后过滤 `teacherId === teacherId`，返回符合条件的键列表。
* `prefix` 为 `record:${classId}:`：
  读取 `data/records/${classId}/` 目录，遍历其中所有的 `.json` 文件，返回其对应的月度键名 `record:${classId}:${yearMonth}`。

### 2.2 存储键（Key）命名规范
1. **教师表**：
   * **Key**: `teacher:all`
   * **数据类型**: `Array<{ id, name, username, password }>` 的 JSON 序列化字符串。
2. **班级表**：
   * **Key**: `class:${teacherId}:${classId}`
   * **数据类型**: `{ id, name, teacherId, students: [...] }` 的 JSON 序列化字符串。
3. **签到记录（月度聚合设计）**：
   * **Key**: `record:${classId}:${yearMonth}` (其中 `yearMonth` 格式为 `YYYY-MM`，如 `2026-07`)
   * **数据类型**: 按天聚合的对象 `{ [date]: { date, attendance: [...] } }` 的 JSON 序列化字符串。

### 2.3 核心路由重构方案

#### 1. 登录验证 (`src/app/api/auth/login/route.js`)
* 从 `teacher:all` 获取全量教师数据，查找对应的用户名。

#### 2. 班级服务 (`src/app/api/classes/route.js` & `[id]/route.js`)
* **获取班级列表 (GET)**：
  调用 `list({ prefix: "class:${teacherId}:" })` 列出当前老师的班级 Key 集合，然后并发调用 `get` 读取各个班级的信息进行组装。
* **创建新班级 (POST)**：
  解析上传 of Excel 得到班级和学生，调用 `put("class:${teacherId}:${classId}", JSON.stringify(newClass))` 写入 KV。
* **获取单个班级 (GET `[id]/route.js`)**：
  直接拼接 `class:${teacherId}:${id}` 调用 `get`，这能防止越权。若为空则返回 404。

#### 3. 签到提交 (`src/app/api/attendance/submit/route.js`)
* 校验班级是否存在：拼接 `class:${teacherId}:${classId}` 调用 `get`。
* 合并写入：根据签到日期 `date` 得到月份 `yearMonth`，并发起 `get("record:${classId}:${yearMonth}")`。
* 将新的签到数据插入或覆盖到该月份的记录中：`records[date] = { date, attendance }`，然后再 `put("record:${classId}:${yearMonth}", JSON.stringify(records))` 写入 KV。

#### 4. 签到状态校验 (`src/app/api/attendance/check-status/route.js`)
* 根据日期获得 `yearMonth`，`get("record:${classId}:${yearMonth}")`。
* 返回 `!!records[date]`。

#### 5. 考勤数据查询 (`src/app/api/attendance/query/route.js`)
* 根据传入的 `startDate` 和 `endDate` 计算出跨越的年月列表。
* 若未传入日期，则通过 `list({ prefix: "record:${classId}:" })` 列出包含该班级历史记录的所有月份键名。
* 并发 `get` 这些月份的数据，在内存中过滤在范围内的签到天数并组装考勤报表。

## 3. 测试与验证方案
1. **本地单元测试 (`tests/kv.test.js`)**：
   编写一个独立的脚本，专门对 `src/utils/kv.js` 的 `get`, `put`, `list`, `delete` 功能在本地文件映射模式下进行覆盖率测试，验证其在本地模拟是否正常工作。
2. **端到端测试**：
   运行本地项目，执行现有的 Playwright 自动化测试（`npm run test` 或 `npx playwright test`），确保所有 API 重构后业务逻辑完全正常且测试用例 100% 通过。

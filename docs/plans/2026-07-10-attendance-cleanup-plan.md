# 班级签到记录历史数据清理功能实现计划 (更新版)

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在班级页面（工作台）的查询按钮下方新增“清理”按钮，点击后弹窗选择截止日期，确认后删除此日期（含）之前的签到记录，并在后台执行 KV 月度数据的过滤清理。
*注：应用户要求，此版本已移除自动化测试步骤，且不使用原生 alert 提示，全部在 Modal 弹窗内展示交互结果。*

**Architecture:** 
1. 前端在班级工作台 [page.js](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/page.js) 中直接挂载清理 Modal，默认日期填充 6 个月前的第一天，点击确认并经过二次防误触确认后，向后端发起清理请求。
2. 弹窗内部集成清理中、成功与失败状态，清理成功后提示用户并提供“我知道了”按钮，点击后自动刷新页面数据并关闭弹窗。
3. 后端新增 [clear.js](file:///D:/code/checkInReact/functions/api/attendance/clear.js)，获取当前班级在 KV 中的所有月份记录 key，遍历并读取其打卡数据，滤除目标截止日期（含）前的打卡明细，将剩余数据写回 KV。若当月数据为空则清理整月 Key。

**Tech Stack:** Next.js (Client Component), Vanilla CSS, Tencent EdgeOne KV

---

### Task 1: 前端清理 UI 与交互逻辑实现

**Files:**
- Modify: [src/app/class/[id]/page.js](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/page.js)

**实现步骤：**
1. 在 `src/app/class/[id]/page.js` 中定义 `isClearModalOpen`, `clearDate`, `isClearing`, `clearStatus`（可选值：`idle` / `success` / `error`）, `clearErrorMessage` 等状态。
2. 编写 `getDefaultClearDate` 函数，获取 6 个月前的月份 1 日。
3. 在“查询”按钮下方新增“清理”按钮，点击后触发 `setIsClearModalOpen(true)` 并初始化状态。
4. 渲染模态框（Modal）HTML 结构。根据 `clearStatus` 渲染不同的子界面：
   * `idle`: 显示截止日期选择框，以及“取消”和“确认删除”按钮（点击确认后拉起浏览器原生 `confirm` 二次确认）。
   * `success`: 显示成功信息（不使用 `alert`），例如“✅ 清理成功！已清除所选日期之前的打卡记录”，并提供一个“确定”按钮。
   * `error`: 显示错误原因并提供“返回”重试或关闭按钮。
5. 编写清理请求函数 `handleClearRecords`，发送 `api.post('/api/attendance/clear', { classId, date: clearDate })` 请求。
   * 发送前设置 `isClearing` 并将 `clearStatus` 设为 `idle`。
   * 成功后设置 `clearStatus` 为 `success`。
   * 失败后设置 `clearStatus` 为 `error` 并保存错误消息。
6. 点击成功状态下的“确定”按钮时，重新调用页面上的 `fetchData()` 或重新拉取今日签到状态（为了刷新页面数据），并关闭 Modal。
7. 暂存并提交代码。

---

### Task 2: 后端清理 API 接口实现

**Files:**
- Create: [functions/api/attendance/clear.js](file:///D:/code/checkInReact/functions/api/attendance/clear.js)

**实现步骤：**
1. 新建 `functions/api/attendance/clear.js` 文件。
2. 验证请求方法为 `POST`。
3. 鉴权：获取 `getAuthUser(env, request)`，如未授权返回 401。
4. 解析并校验参数 `classId` 与 `date`（`YYYY-MM-DD` 格式）。
5. 校验班级归属权：读取 `class:${user.id}:${classId}`。若不存在返回 404。
6. 执行数据过滤清理：
   * 利用 `kv.list(env, { prefix: `record:${classId}:` })` 获取当前班级所有的月份记录 Key。
   * 遍历 Key，若 Key 的 `yearMonth <= date.substring(0, 7)`，则：
     * 读取对应的 KV 值，解析为对象。
     * 删除所有日期小于或等于截止日期 `date` 的记录值。
     * 若清理后该月份记录为空，则彻底 `kv.deleteKey` 删除该 Key；否则将剩余记录写回 KV。
7. 返回 `{ success: true }` 成功响应。
8. 暂存并提交代码。

---

### Task 3: 玻璃拟物化样式美化

**Files:**
- Modify: [src/app/class/[id]/classhome.css](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/classhome.css)

**实现步骤：**
1. 在 `classhome.css` 中，为新引入的清理按钮和模态框组件设计磨砂玻璃（glassmorphism）样式，确保整体视觉效果高端、 alive，契合班级工作台的原有色调。
2. 实现警告红色的微动画 hover 状态。
3. 手动在浏览器中全面测试各边界输入与交互状态，确保流程无瑕疵。
4. 暂存并提交代码。

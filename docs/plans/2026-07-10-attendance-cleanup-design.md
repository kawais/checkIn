# 设计文档：班级签到记录历史数据清理功能

* 创建日期：2026-07-10
* 状态：已批准
* 作者：Antigravity

---

## 1. 需求背景
随着签到数据的累积，班级可能会产生大量无用的历史签到记录。为了方便数据维护和节省 KV 存储空间，需要在“班级工作台”的“查询”按钮下方增加一个“清理”按钮。
点击后，在当前页面直接弹出模态框（Modal），允许用户选择截止日期（默认值为 6 个月前的月份 1 日），确认后将该日期（含）之前该班级的所有打卡记录从后台永久删除。

---

## 2. 系统架构与数据流

```mermaid
sequenceDiagram
    actor User as 教师/管理员
    participant FE as 前端页面 (ClassHomePage)
    participant BE as 后端 API (clear.js)
    database KV as EdgeOne KV

    User->>FE: 点击工作台“清理”按钮
    FE->>FE: 渲染清理弹窗 (默认填入6个月前的1日)
    User->>FE: 选择截止日期并点击“确认删除”
    FE->>FE: 弹出二次确认弹窗
    User->>FE: 确认
    FE->>BE: POST /api/attendance/clear { classId, date }
    BE->>BE: 鉴权与班级归属校验
    BE->>KV: 列出 record:classId:* 键
    loop 每一个月份 Key (yearMonth <= date所在年月)
        BE->>KV: 获取当前月打卡记录
        BE->>BE: 清理 date 之前的每日记录
        alt 剩余记录为空
            BE->>KV: 删除该月份 Key (deleteKey)
        else 还有剩余记录
            BE->>KV: 写回更新后的数据 (put)
        end
    end
    BE-->>FE: 返回 { success: true }
    FE-->>User: 弹出清理成功提示并自动刷新/关闭弹窗
```

---

## 3. 前端设计 (UI/UX)
在 [src/app/class/[id]/page.js](file:///D:/code/checkInReact/src/app/class/%5Bid%5D/page.js) 中直接集成清理弹窗组件。

### 3.1 默认值计算
默认选择 **6个月之前的月份 1 日**：
```javascript
const getDefaultClearDate = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
};
```

### 3.2 交互防误触
1. 点击“确认删除”后，会使用 `window.confirm` 进行二次弹窗确认：
   *提示：“您确定要永久删除 [所选日期]（含）之前的签到记录吗？此操作不可逆！”*
2. 清理提交期间，按钮处于禁用状态（`disabled={isClearing}`）并显示“正在清理...”。
3. 成功后，使用浏览器原生或系统提示“清理成功”，并重置打卡数据状态。

---

## 4. 后端设计 (API)

### 4.1 接口规格
* **路径**：`functions/api/attendance/clear.js`
* **方法**：`POST`
* **载荷 (Payload)**：
  ```json
  {
    "classId": "string",
    "date": "string (YYYY-MM-DD)"
  }
  ```
* **响应**：
  * `200 OK`：`{ "success": true }`
  * `400 Bad Request`：`{ "error": "参数格式错误" }`
  * `401 Unauthorized`：`{ "error": "未授权，请登录" }`
  * `404 Not Found`：`{ "error": "班级不存在或无操作权限" }`
  * `500 Internal Server Error`：`{ "error": "服务器内部错误" }`

### 4.2 KV 清理算法
KV 键的设计是月度聚合的，即 `record:${classId}:${yearMonth}`，其中 `yearMonth` 的格式为 `YYYY-MM`。
清理算法需要：
1. `kv.list` 查找所有匹配前缀 `record:${classId}:` 的键。
2. 过滤出 `yearMonth <= targetYearMonth` 的键进行处理。
3. 对符合的每个键获取其 Value（反序列化为 JSON 对象 `monthlyRecords`）。
4. 过滤删除所有 `dayDate <= targetDate` 键名的记录对象。
5. 若处理后 `monthlyRecords` 键集为空，则直接调用 `kv.deleteKey(env, key)`。
6. 若不为空，调用 `kv.put(env, key, JSON.stringify(monthlyRecords))` 存回。

---

## 5. 测试要点
1. **边界日期测试**：截止日期设定在月初（如 2026-01-01），月中（如 2026-01-15），月末（如 2026-01-31），验证对应日期的打卡记录是否正确删除，大于该日期的记录是否安全保留。
2. **越权测试**：使用普通账号 A 尝试调用接口清理账号 B 下的班级数据，验证是否拦截并返回 `404/403`。
3. **空月删除测试**：当某月的所有记录都被删空时，确认对应的 KV key 已被彻底从数据库中 delete。

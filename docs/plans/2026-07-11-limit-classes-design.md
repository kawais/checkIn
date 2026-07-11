# 账号创建班级数量限制设计文档 (Design Document: Limiting Classes Per Account)

## 1. 背景与需求 (Background & Requirements)
* **需求**：每个账号最多只能创建 2 个班级。
* **交互规则**：
  * 后端接口进行严格校验，当班级数达到 2 个时拦截创建请求。
  * 前端禁用所有创建班级的入口（右上角“+”按钮和空状态下的“创建班级”按钮），并在列表顶部清晰展示当前创建的班级数量及上限（如 `2/2`）。

## 2. 详细设计 (Detailed Design)

### 2.1 后端修改 (Backend Changes)
* **文件路径**：[functions/api/classes/index.js](file:///D:/code/checkInReact/functions/api/classes/index.js)
* **逻辑实现**：
  在 `POST` 方法中解析表单前或后，拉取当前用户的班级列表：
  ```javascript
  const listResult = await kv.list(env, { prefix: 'class:' + user.id + ':' });
  const keys = Array.isArray(listResult?.keys) ? listResult.keys : [];
  if (keys.length >= 2) {
    return new Response(JSON.stringify({ error: '每个账号最多只能创建 2 个班级' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
  ```

### 2.2 前端页面修改 (Frontend Page Changes)
* **文件路径**：[src/app/classes/page.js](file:///D:/code/checkInReact/src/app/classes/page.js)
* **逻辑实现**：
  * 计算是否超出上限：`const isLimitReached = classesList.length >= 2;`
  * 右上角创建按钮：
    ```jsx
    <button 
      className="icon-btn add-btn" 
      onClick={openDrawer} 
      disabled={isLimitReached} 
      title={isLimitReached ? '已达创建上限 (2/2)' : '创建班级'}
    >
    ```
  * 顶部计数角标：
    ```jsx
    {classesList.length > 0 && (
      <span className={`count-badge ${isLimitReached ? 'limit-reached' : ''}`}>
        {isLimitReached ? '班级数已达上限 2/2' : `班级数量: ${classesList.length}/2`}
      </span>
    )}
    ```
  * 空状态下按钮：
    ```jsx
    <button className="action-btn" onClick={openDrawer} disabled={isLimitReached}>创建班级</button>
    ```

### 2.3 样式修改 (Style Changes)
* **文件路径**：[src/app/classes/classes.css](file:///D:/code/checkInReact/src/app/classes/classes.css)
* **CSS 实现**：
  ```css
  /* 禁用创建按钮样式 */
  .add-btn:disabled,
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    pointer-events: none;
    box-shadow: none;
    background: var(--text-secondary);
  }

  /* 上限红色警告角标 */
  .count-badge.limit-reached {
    color: #FF3B30;
    background: rgba(255, 59, 48, 0.1);
  }
  ```

## 3. 测试验证 (Verification)
* 根据用户要求：“开发完成无需测试”。但我们依然会在代码编译构建层面进行验证，确保没有语法错误和逻辑漏洞。

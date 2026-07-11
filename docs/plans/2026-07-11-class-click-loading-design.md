# 班级页面点击签到/查询时增加 Loading 设计文档

## 1. 变更背景与需求
在班级工作台页面，点击“签到”或“查询”按钮时，客户端路由跳转（Next.js `router.push`）存在一定的加载和渲染延迟。如果在跳转期间没有视觉反馈，用户可能会重复点击或感到界面响应迟钝。因此，需要在点击这些跳转按钮时，立刻展示全屏 Loading 遮罩。

## 2. 方案设计
采用与从班级列表页进入班级工作台一致的全屏毛玻璃遮罩（`.full-page-loading`）。
- **签到按钮点击**：点击后显示“正在载入签到页面...”。
- **查询按钮点击**：点击后显示“正在载入查询报表...”。
- **交互控制**：加载状态触发后显示遮罩，并在组件卸载（或跳转完毕）时随之销毁，且阻止用户进行其他点击交互。

## 3. 具体修改内容

### 3.1 前端页面 (`src/app/class/[id]/page.js`)
1. 引入状态：
```javascript
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationText, setNavigationText] = useState('');
```
2. 修改跳转事件：
```javascript
  const startCheckIn = () => {
    setIsNavigating(true);
    setNavigationText('正在载入签到页面...');
    router.push(`/class/${classId}/checkin`);
  };

  const queryRecords = () => {
    setIsNavigating(true);
    setNavigationText('正在载入查询报表...');
    router.push(`/class/[id]/query`); // 具体根据原有路由确定
  };
```
3. 在 JSX 返回的根节点内增加渲染：
```jsx
      {/* 页面跳转 loading */}
      {isNavigating && (
        <div className="full-page-loading">
          <div className="spinner"></div>
          <p>{navigationText}</p>
        </div>
      )}
```

### 3.2 样式文件 (`src/app/class/[id]/classhome.css`)
追加全屏 Loading 遮罩样式：
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

## 4. 验证计划
1. 在班级工作台页面点击“签到”按钮，检查是否立刻弹出毛玻璃遮罩并显示“正在载入签到页面...”。
2. 点击“查询”按钮，检查是否立刻弹出毛玻璃遮罩并显示“正在载入查询报表...”。
3. 编写/运行 Playwright 测试以验证这两种跳转状态下 Loading 的显隐。

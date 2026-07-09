# 班级列表点击班级增加 Loading 遮罩设计文档

## 1. 需求背景
在“班级列表”页面中，教师点击班级卡片后，Next.js 会开始加载班级工作台页面的数据和组件。由于路由跳转和首屏渲染需要一定时间，在此期间页面没有任何视觉反馈，容易导致用户误以为没有点中或页面卡死。

为了提升用户体验（Premium UI/UX），需要在点击班级卡片时立即显示一个全屏毛玻璃 Loading 遮罩层，阻断其他点击操作，直到新页面渲染完毕。

## 2. 交互设计
- **触发时机**：点击任何班级卡片。
- **视觉呈现**：
  - 半透明的黑色背景遮罩（`rgba(0, 0, 0, 0.45)`）。
  - iOS 风格的毛玻璃模糊特效（`backdrop-filter: blur(10px)`），能自适应明亮与暗黑模式。
  - 居中的白色旋转加载动画（Spinner）。
  - Loading 提示语：“正在载入班级...”。
- **阻断行为**：遮罩层以 `z-index: 9999` 覆盖全屏，屏蔽用户在等待期间的所有点击操作，防止重复触发路由跳转。

## 3. 技术方案
采用 React 组件状态控制。
1. 在 `src/app/classes/page.js` 页面中维护一个 `isRedirecting` 状态：
   ```javascript
   const [isRedirecting, setIsRedirecting] = useState(false);
   ```
2. 当点击卡片触发 `goToClass` 函数时，先将 `isRedirecting` 设为 `true`，然后再调用 `router.push`。
3. 在 JSX 中条件渲染遮罩层 DOM。
4. 在 `classes.css` 中增加对应的全屏遮罩及动画样式。

## 4. 影响范围
- 修改文件：
  - `src/app/classes/page.js` (React 组件逻辑与结构)
  - `src/app/classes/classes.css` (遮罩层样式与旋转动画)

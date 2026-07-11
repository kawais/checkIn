# 签到页面增加长按备注文字提示设计文档

## 1. 变更背景与需求
目前签到系统已支持“长按学生姓名卡片可以弹出备注弹窗”的功能，但由于界面缺乏直观引导，用户很难发现这一隐藏交互。因此，需要在签到页面显式增加文字提示：“长按姓名可添加备注”，以引导用户使用。

## 2. 方案设计 (方案 A)
在签到页面的“全选/反选”控制栏下方单独增加一行居左对齐的灰色提示小字。
- **提示文字内容**：`长按姓名可添加备注`
- **视觉修饰**：在其左侧加入一个精美的 SVG Info 圈号图标，使用系统的主色调（`var(--primary-color)`）进行点缀，提示文字采用副文本颜色（`var(--text-secondary)`），字号 12px。
- **布局适配**：在移动端不同宽度屏幕下自动占满宽度，不受按钮折行影响。

## 3. 具体修改内容

### 3.1 前端页面 (`src/app/class/[id]/checkin/page.js`)
在全局控制按钮区域 `.global-controls-section` 后面插入提示节点：
```jsx
{/* 全局控制按钮 */}
<div className="global-controls-section">
  <button className="control-btn" onClick={handleSelectAll}>全选</button>
  <button className="control-btn" onClick={handleInvertSelection}>反选</button>
</div>

{/* 提示文字 */}
<div className="checkin-hint-text">
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="hint-icon">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="16" x2="12" y2="12"></line>
    <line x1="12" y1="8" x2="12.01" y2="8"></line>
  </svg>
  <span>长按姓名可添加备注</span>
</div>
```

### 3.2 样式文件 (`src/app/class/[id]/checkin/checkin.css`)
追加样式，保证提示文字在各种主题下（包括 Dark Mode）的可读性：
```css
.checkin-hint-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-secondary);
  padding: 0 8px;
  margin-bottom: 12px;
  opacity: 0.8;
}

.checkin-hint-text .hint-icon {
  flex-shrink: 0;
  color: var(--primary-color);
}
```

## 4. 验证计划
1. 本地启动应用并进入签到页面。
2. 检查控制按钮下方是否正常出现了包含图标的“长按姓名可添加备注”灰色字样。
3. 检查不同尺寸屏幕适配，确保没有溢出或严重换行。
4. 切换深浅色主题，确保字样清晰且符合规范。

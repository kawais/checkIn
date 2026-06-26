# Custom Confirm Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the native `confirm()` in the check-in page with a beautiful, reusable iOS-style custom Glassmorphic dialog component.

**Architecture:** Create a reusable React component `ConfirmDialog` in `src/components/` and import it into `src/app/class/[id]/checkin/page.js`, managing its visibility state locally.

**Tech Stack:** React 19, CSS, Next.js 16.

---

### Task 1: Create Confirm Dialog CSS

**Files:**
- Create: `src/components/ConfirmDialog.css`

**Step 1: Write implementation**

Create `src/components/ConfirmDialog.css` with the following content:
```css
.confirm-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 1100;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.25s ease, visibility 0.25s ease;
}

.confirm-modal-overlay.open {
  opacity: 1;
  visibility: visible;
}

.confirm-modal-card {
  width: 100%;
  max-width: 290px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: var(--glass-border);
  box-shadow: var(--glass-shadow);
  border-radius: 14px;
  text-align: center;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(0.9);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.confirm-modal-overlay.open .confirm-modal-card {
  transform: scale(1);
}

.confirm-modal-content {
  padding: 20px 16px;
}

.confirm-modal-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 6px;
}

.confirm-modal-message {
  font-size: 13px;
  color: var(--text-color);
  line-height: 1.4;
  opacity: 0.85;
}

.confirm-modal-divider {
  height: 1px;
  background-color: rgba(0, 0, 0, 0.15);
  width: 100%;
}

html.dark .confirm-modal-divider {
  background-color: rgba(255, 255, 255, 0.15);
}

.confirm-modal-actions {
  display: flex;
  height: 44px;
}

.confirm-modal-btn {
  flex: 1;
  background: transparent;
  border: none;
  font-size: 16px;
  font-weight: 400;
  cursor: pointer;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-color);
  outline: none;
  transition: background-color 0.15s ease;
}

.confirm-modal-btn:active {
  background-color: rgba(0, 0, 0, 0.05);
}

html.dark .confirm-modal-btn:active {
  background-color: rgba(255, 255, 255, 0.05);
}

.confirm-modal-btn.cancel {
  font-weight: 500;
}

.confirm-modal-btn.confirm-danger {
  color: var(--danger-color);
  font-weight: 600;
}

.confirm-modal-btn.confirm-default {
  font-weight: 600;
}

.confirm-modal-btn-divider {
  width: 1px;
  background-color: rgba(0, 0, 0, 0.15);
  height: 100%;
}

html.dark .confirm-modal-btn-divider {
  background-color: rgba(255, 255, 255, 0.15);
}
```

**Step 2: Commit**

```bash
git add src/components/ConfirmDialog.css
git commit -m "style: add CSS styling for custom ConfirmDialog"
```

---

### Task 2: Create React Component

**Files:**
- Create: `src/components/ConfirmDialog.js`

**Step 1: Write implementation**

Create `src/components/ConfirmDialog.js` with the following content:
```javascript
'use client';

import { useEffect } from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  isOpen,
  title = '提示',
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'danger' // 'default' | 'danger'
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <div className={`confirm-modal-overlay ${isOpen ? 'open' : ''}`} onClick={onCancel}>
      <div className="confirm-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-content">
          <h3 className="confirm-modal-title">{title}</h3>
          <p className="confirm-modal-message">{message}</p>
        </div>
        <div className="confirm-modal-divider"></div>
        <div className="confirm-modal-actions">
          <button className="confirm-modal-btn cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <div className="confirm-modal-btn-divider"></div>
          <button
            className={`confirm-modal-btn ${type === 'danger' ? 'confirm-danger' : 'confirm-default'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/ConfirmDialog.js
git commit -m "feat: implement reusable iOS-style ConfirmDialog component"
```

---

### Task 3: Integrate with checkin page

**Files:**
- Modify: `src/app/class/[id]/checkin/page.js`

**Step 1: Write implementation**

Modify `src/app/class/[id]/checkin/page.js` to import and use `ConfirmDialog`.
Replace the native `confirm()` check in `goBack()` with setting state `isConfirmOpen`.

1. Import component:
```javascript
import ConfirmDialog from '@/components/ConfirmDialog';
```

2. Add State:
```javascript
const [isConfirmOpen, setIsConfirmOpen] = useState(false);
```

3. Update `goBack` and render logic:
```javascript
  const goBack = () => {
    setIsConfirmOpen(true);
  };
```

4. Render `<ConfirmDialog>` at the bottom of the component:
```javascript
      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="确认退出"
        message="确定要退出签到吗？当前进度不会保存。"
        confirmText="确定退出"
        cancelText="取消"
        type="danger"
        onConfirm={() => {
          setIsConfirmOpen(false);
          router.push(`/class/${classId}`);
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
```

**Step 2: Commit**

```bash
git add src/app/class/\[id\]/checkin/page.js
git commit -m "feat: replace native confirm in checkin page with ConfirmDialog"
```

---

### Task 4: E2E and visual verification

**Step 1: Run dev server and test manually**
- Run `npm run dev` and click "取消" on check-in page. Verify Custom Dialog opens with correct styles.
- Click "取消" on dialog to close.
- Click "确定" on dialog to redirect to workbench.

**Step 2: Run playwright tests**
- Run playwright tests to verify everything passes:
  `npx playwright test`

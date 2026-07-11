# Limit Classes Per Account Implementation Plan

> **For Gemini:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Limit each user account to creating at most 2 classes, including UI updates (disable creation entry, show limit badge) and backend API validation (return 400 when limit reached).

**Architecture:** 
- In the backend, retrieve user classes key prefix count in KV store and block requests if length >= 2.
- In the frontend, calculate if classes count reaches 2, disable buttons, and add a warning label.
- Add CSS styling for disabled buttons and error warning label.

**Tech Stack:** Next.js, Cloudflare Workers KV API, Vanilla CSS.

---

### Task 1: Backend API Validation

**Files:**
- Modify: `functions/api/classes/index.js`

**Step 1: Write backend logic to count and restrict class creation**
Insert validation at `functions/api/classes/index.js` in `request.method === 'POST'`.

**Step 2: Commit**
```bash
git add functions/api/classes/index.js
git commit -m "feat(api): enforce maximum of 2 classes per account on backend"
```

---

### Task 2: Frontend Page Modification

**Files:**
- Modify: `src/app/classes/page.js`

**Step 1: Check limit and disable button actions in page.js**
- Calculate `isLimitReached = classesList.length >= 2`.
- Update the class count badge,右上角 `+` button, and empty state action button to support disabled state and title text.

**Step 2: Commit**
```bash
git add src/app/classes/page.js
git commit -m "feat(ui): disable class creation buttons and show 2/2 limit badge when limit is reached"
```

---

### Task 3: CSS Styling Updates

**Files:**
- Modify: `src/app/classes/classes.css`

**Step 1: Style the disabled buttons and red count badge**
- Add disabled styles for `.add-btn:disabled` and `.action-btn:disabled`.
- Add `.count-badge.limit-reached` for danger color styling.

**Step 2: Commit**
```bash
git add src/app/classes/classes.css
git commit -m "style: add styles for disabled creation buttons and limit warning badge"
```

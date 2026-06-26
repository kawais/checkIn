# 2026-06-27 Custom Confirm Design

## Overview
Replace the native browser `confirm()` window in the React/Next.js check-in web application with a beautiful, reusable iOS-style Glassmorphism `ConfirmDialog` component.

## File Changes
We will create:
1. `src/components/ConfirmDialog.js` - The React component.
2. `src/components/ConfirmDialog.css` - The iOS Glassmorphic CSS style.

We will modify:
3. `src/app/class/[id]/checkin/page.js` - Use `<ConfirmDialog>` instead of `confirm()`.

## Component Details
### React Component (`ConfirmDialog.js`)
- Functional component receiving props: `isOpen`, `title`, `message`, `confirmText`, `cancelText`, `onConfirm`, `onCancel`, `type` ('default' | 'danger').
- Handles keypress (Escape) to trigger `onCancel`.
- Prevents propagation of click events from dialog card to overlay.

### CSS Styling (`ConfirmDialog.css`)
- Centered layout, fixed positioning.
- Glassmorphism styling (`--glass-bg`, `--glass-border`, `--glass-blur`, `--glass-shadow` from `globals.css`).
- Layout structure:
  - Header: title and message.
  - Footer: horizontal divider, side-by-side buttons separated by a vertical divider.
- Colors:
  - Cancel button: default text color.
  - Confirm button: `--primary-color` (default) or `--danger-color` (`danger`).
- Animation: `fadeIn` for overlay, `scaleIn` for card.

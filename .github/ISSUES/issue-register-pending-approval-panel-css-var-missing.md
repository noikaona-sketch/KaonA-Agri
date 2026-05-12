# [BUG] `PendingApprovalPanel` ใช้ CSS variable ที่ไม่มีในระบบ

**Labels:** `bug` `ui`  
**Priority:** P2

## ปัญหา

`src/shared/pending-approval/pending-approval-panel.tsx`:

```tsx
<article style={{ border: '1px solid var(--line-soft)', ... }}>
  <p style={{ color: 'var(--text-muted)' }}>
```

แต่ใน `globals.css` ไม่มี `--line-soft` หรือ `--text-muted`  
CSS variables ที่ระบบมีจริง: `--border`, `--text-secondary`

ผลลัพธ์: border และสีข้อความแสดงผิดบน panel นี้

## วิธีแก้

```tsx
// เปลี่ยนเป็น
border: '1px solid var(--border)'
color: 'var(--text-secondary)'
```

## Acceptance Criteria

- [ ] `PendingApprovalPanel` แสดงผลถูกต้องโดยไม่มี CSS variable ขาดหาย

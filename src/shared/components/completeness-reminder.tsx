'use client';

import Link from 'next/link';

import { useCurrentMember } from '@/providers/auth-provider';
import { useMemberCompleteness } from '@/shared/hooks/use-member-completeness';

// ─────────────────────────────────────────────────────────────────────────────
// CompletenessReminder — Issue #213 PR1
//
// Renders a soft reminder card when:
//   - member is approved (Level 1)
//   - member has no plots (not Level 2)
//   - plot count has finished loading
//   - no fetch error
//
// Never hard-blocks. Children always render beneath the reminder.
// ─────────────────────────────────────────────────────────────────────────────
export function CompletenessReminder() {
  const member      = useCurrentMember();
  const { hasPlot, loading, error } = useMemberCompleteness();

  // Conditions to show reminder:
  const isApproved = member?.is_approved === true && member?.status === 'approved';
  const show = isApproved && !loading && !error && !hasPlot;

  if (!show) return null;

  return (
    <div
      role="status"
      aria-label="ข้อมูลยังไม่ครบ"
      style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          12,
        background:   '#fffbeb',
        border:       '1px solid #fcd34d',
        borderRadius: 12,
        padding:      '14px 16px',
        marginBottom: 16,
      }}
    >
      {/* Icon */}
      <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0, marginTop: 1 }}>
        📋
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 14, color: '#92400e' }}>
          ข้อมูลยังไม่ครบ
        </p>
        <p style={{ margin: '0 0 10px', fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
          เพิ่มข้อมูลแปลงเพื่อใช้งานเต็มรูปแบบ
        </p>
        <Link
          href="/plots/add"
          style={{
            display:      'inline-block',
            padding:      '7px 16px',
            background:   '#d97706',
            color:        '#fff',
            borderRadius: 8,
            fontSize:     13,
            fontWeight:   600,
            textDecoration: 'none',
          }}
        >
          + เพิ่มแปลงเกษตร
        </Link>
      </div>
    </div>
  );
}

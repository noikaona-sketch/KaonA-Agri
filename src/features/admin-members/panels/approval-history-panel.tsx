'use client';
type LogRow = { id: string; action: string; reason: string | null; acted_by: string | null; created_at: string };
export function ApprovalHistoryPanel({ logs }: { logs: LogRow[] }) {
  if (logs.length === 0) return null;
  return (
    <section>
      <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#0d3d1f' }}>📝 ประวัติการดำเนินการ</h2>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>การกระทำ</th><th>เหตุผล</th><th>โดย</th><th>วันที่</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600 }}>{l.action}</td>
                <td style={{ color: '#6b7280', fontSize: 13 }}>{l.reason ?? '—'}</td>
                <td style={{ fontSize: 12, color: '#6b7280' }}>{l.acted_by ?? '—'}</td>
                <td style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {new Date(l.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
